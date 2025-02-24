const mongoose = require("mongoose");
const crypto = require("crypto");
require("dotenv").config();
const UserProfile = require("../models/UserProfile");

const AES_SECRET_KEY = process.env.AES_SECRET_KEY;
const getAESKey = () =>
  crypto.createHash("sha256").update(String(AES_SECRET_KEY)).digest();

const encryptMessage = (text) => {
  const iv = crypto.randomBytes(16);
  const key = getAESKey();
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: iv.toString("hex"), encryptedData: encrypted };
};

const decryptMessage = (encryptedText, iv) => {
  const key = getAESKey();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(iv, "hex"));
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "UserAuth", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "UserAuth" },
  encryptedMessage: { type: String, required: true },
  iv: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const transactionSchema = new mongoose.Schema({
  applicantID: { type: mongoose.Schema.Types.ObjectId, ref: "UserAuth" },
  applicantInfo: { identity: { type: String }, details: { type: String } },
  jobID:{type:mongoose.Schema.Types.ObjectId,ref:"Job"},
  offerPrice: Number,
  status: { type: String, enum: ["pending", "accepted", "completed"], default: "pending" },
  applicantAnonymous: { type: Boolean, default: true },
  revealIdentity: { type: Boolean, default: false },
}, { _id: false });

const chatLogSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserAuth",
        required: true,
      },
    ],
    messages: [messageSchema],
    chatType: { type: String, enum: ["general", "job"], default: "general" },
    transaction: {type:transactionSchema,default:{}},
  },
  { timestamps: true }
);

chatLogSchema.methods.addMessage = async function (sender, recipient, text) {
  const { iv, encryptedData } = encryptMessage(text);
  this.messages.push({ sender, recipient, encryptedMessage: encryptedData, iv });
  await this.save();
};

chatLogSchema.methods.deleteMessage = async function (messageId) {
  this.messages = this.messages.filter(
    (msg) => msg._id.toString() !== messageId.toString()
  );
  await this.save();
};

chatLogSchema.methods.editMessage = async function (messageId, newText) {
  const message = this.messages.id(messageId);
  if (message) {
    const { iv, encryptedData } = encryptMessage(newText);
    message.encryptedMessage = encryptedData;
    message.iv = iv;
    message.timestamp = new Date();
    await this.save();
  } else {
    throw new Error("Message not found");
  }
};

chatLogSchema.methods.getDecryptedMessages = function () {
  return this.messages.map((msg) => ({
    msgID: msg._id.toHexString(),
    sender: msg.sender,
    recipient: msg.recipient,
    message: decryptMessage(msg.encryptedMessage, msg.iv),
    timestamp: msg.timestamp,
  }));
};

chatLogSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.chatID = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
chatLogSchema.set("toObject", { virtuals: true });

chatLogSchema.methods.toAnonymous = async function () {
  const chat = this.toObject({ virtuals: true });
  if (chat.chatType === "job" && chat.transaction && chat.transaction.applicantAnonymous && !chat.transaction.revealIdentity) {
    const profile = await UserProfile.findOne({ user: chat.transaction.applicantID });
    if (profile && profile.anonymousInfo && profile.anonymousInfo.anonymousIdentity) {
      chat.participants = chat.participants.map((participant) => {
        if (participant._id ? participant._id.toString() === chat.transaction.applicantID.toString() : participant.toString() === chat.transaction.applicantID.toString()) {
          return { ...participant, anonymousIdentity: profile.anonymousInfo.anonymousIdentity };
        }
        return participant;
      });
    }
  }
  return chat;
};

module.exports = mongoose.model("ChatLog", chatLogSchema);
