const mongoose = require("mongoose");
const crypto = require("crypto");
require("dotenv").config();

const AES_SECRET_KEY =
  process.env.AES_SECRET_KEY ||
  "115NEQrOTRcxxp927aecSbZXUERoFyvYz71GrxabigODAJ+eUp1lnIw2tG2YkdLk"; 
  
// Function to encrypt a message
const encryptMessage = (text) => {
  const iv = crypto.randomBytes(16);
const key = crypto.createHash('sha256').update(String(AES_SECRET_KEY)).digest();
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return {
    iv: iv.toString("hex"),
    encryptedData: encrypted,
  };
};

// Function to decrypt a message
const decryptMessage = (encryptedText, iv) => {
const key = crypto.createHash('sha256').update(String(AES_SECRET_KEY)).digest();
const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

// Message sub-schema
const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Recipient is optional since a chat is between participants
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  encryptedMessage: {
    type: String,
    required: true,
  },
  iv: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// ChatLog schema
const chatLogSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    messages: [messageSchema],
  },
  { timestamps: true }
);

// Add a message to the chat (encrypts before storing)
chatLogSchema.methods.addMessage = async function (sender, recipient, text) {
  const { iv, encryptedData } = encryptMessage(text);
  this.messages.push({
    sender,
    recipient,
    encryptedMessage: encryptedData,
    iv,
  });
  await this.save();
};

// Retrieve all decrypted messages
chatLogSchema.methods.getDecryptedMessages = function () {
  return this.messages.map((msg) => ({
    id: msg._id,
    sender: msg.sender,
    recipient: msg.recipient,
    message: decryptMessage(msg.encryptedMessage, msg.iv),
    timestamp: msg.timestamp,
  }));
};

const ChatLog = mongoose.model("ChatLog", chatLogSchema);
module.exports = ChatLog;
