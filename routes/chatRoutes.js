const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const ChatLog = require("../models/ChatLog");
const { verifyToken } = require("../components/jwtUtils");
const { sendToUsers } = require("../components/wsUtils");

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// Create new chat 
router.post("/chat/create", verifyToken, async (req, res) => {
  try {
    const { recipientID, chatType, transaction } = req.body;
    const participants = [toObjectId(req.user.id), toObjectId(recipientID)];
    let chat = await ChatLog.findOne({
      participants: { $all: participants },
      chatType: chatType || "general"
    });
    if (chat) return res.status(200).json(chat.toJSON());

    chat = new ChatLog({
      participants,
      chatType: chatType || "general",
      transaction: transaction || {}
    });
    if (chat.chatType === "job") {
      chat.transaction.applicantAnonymous = true;
      chat.transaction.status = "pending";
      chat.transaction.applicantID = toObjectId(req.user.id);
    }
    await chat.save();
    sendToUsers(participants.map(String), { type: "UPDATE_DATA", update: "chats" });
    res.status(201).json(chat.toJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List chats for current user
router.get("/chats", verifyToken, async (req, res) => {
  try {
    const filter = { participants: toObjectId(req.user.id) };
    if (req.query.chatType) {
      filter.chatType = req.query.chatType;
    }
    const chats = await ChatLog.find(filter)
      .populate("participants", "username avatar userID")
      .exec();
    res.json(chats.map(chat => chat.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message in chat. 
router.post("/chat/send", verifyToken, async (req, res) => {
  try {
    const { chatID, recipientID, text, chatType,jobID } = req.body;
    if (!text) throw new Error("Missing text");

    let chat;
    let recipient;
    if (chatID) {
      chat = await ChatLog.findById(chatID);
      if (!chat) throw new Error("Chat not found");
      recipient = chat.participants.find((p) => p.toString() !== req.user.id);
      if (!recipient) throw new Error("Recipient not found");
    } else if (recipientID) {
      recipient = toObjectId(recipientID);
      const participants = [toObjectId(req.user.id), recipient];
      chat = await ChatLog.findOne({
        participants: { $all: participants },
        chatType: chatType || "general",
        transaction:{jobID:jobID},
      });
      if (!chat) {
        chat = new ChatLog({
          participants,
          chatType: chatType || "general"
        });
        if (chat.chatType === "job") {
          if(jobID){
          chat.transaction.applicantAnonymous = true;
          chat.transaction.status = "pending";
          chat.transaction.applicantID = toObjectId(req.user.id);
          chat.transaction.jobID = toObjectId(jobID);
          }
        else{
          throw new Error("No Job ID specified!")
        }
        }
        await chat.save();
      }
    } else {
      throw new Error("Either chatID or recipientID must be provided");
    }
    await chat.addMessage(req.user.id, recipient.toString(), text);
    sendToUsers([req.user.id, recipient.toString()], { type: "UPDATE_DATA", update: "chats" });
    res.json({ message: "Message sent", chat: chat.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get decrypted messages for a chat
router.get("/chat/messages/:chatId", verifyToken, async (req, res) => {
  try {
    const chat = await ChatLog.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    const messages = chat.getDecryptedMessages();
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific message from a chat
router.delete("/chat/message/:chatId/:messageId", verifyToken, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const chat = await ChatLog.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    await chat.deleteMessage(messageId);
    chat.participants.forEach(participant => {
      if (participant.toString() !== req.user.id) {
        sendToUsers([participant.toString()], { type: "UPDATE_DATA", update: "chats" });
      }
    });
    res.json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a message in a chat
router.put("/chat/message/:chatId/:messageId", verifyToken, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { newText } = req.body;
    const chat = await ChatLog.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    await chat.editMessage(messageId, newText);
    chat.participants.forEach(participant => {
      if (participant.toString() !== req.user.id) {
        sendToUsers([participant.toString()], { type: "UPDATE_DATA", update: "chats" });
      }
    });
    res.json({ message: "Message edited" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an entire chat
router.delete("/chat/:chatId", verifyToken, async (req, res) => {
  try {
    const chat = await ChatLog.findByIdAndDelete(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    chat.participants.forEach(participant => {
      sendToUsers([participant.toString()], { type: "UPDATE_DATA", update: "chats" });
    });
    res.json({ message: "Chat deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update job chat transaction settings
router.put("/chat/job/update/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { revealIdentity, status, offerPrice } = req.body;
    const chat = await ChatLog.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    if (chat.chatType !== "job") {
      return res.status(400).json({ error: "Not a job chat" });
    }
    if (typeof revealIdentity === "boolean") {
      chat.transaction.revealIdentity = revealIdentity;
    }
    if (status) {
      chat.transaction.status = status;
    }
    if (offerPrice !== undefined) {
      chat.transaction.offerPrice = offerPrice;
    }
    await chat.save();
    chat.participants.forEach(participant => {
      sendToUsers([participant.toString()], { type: "UPDATE_DATA", update: "chats" });
    });
    res.json({ message: "Job transaction updated", chat: chat.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
