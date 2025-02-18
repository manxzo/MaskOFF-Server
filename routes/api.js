// [routes/api.js]
// API routes for MaskOFF-Server

const express = require("express");
const router = express.Router();
const User = require("../models/User");
const ChatLog = require("../models/ChatLog");
const { generateToken, verifyToken } = require("../components/jwtUtils");

// Import the targeted update functions from wsUtils
const { sendToUser, sendToUsers } = require("../components/wsUtils");

/*
  ---------------------
  User Endpoints
  ---------------------
*/

// Register a new user
router.post("/newuser", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    const token = generateToken(user);
    res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login a user and return a JWT token
router.post("/users/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ error: "Invalid username or password" });
    const valid = await user.isCorrectPassword(password);
    if (!valid)
      return res.status(400).json({ error: "Invalid username or password" });
    const token = generateToken(user);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a user by ID
router.get("/user/:userID", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userID);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users.map((u) => u.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ---------------------
  Friend Endpoints
  ---------------------
*/

// Send a friend request
router.post("/friends/request", verifyToken, async (req, res) => {
  try {
    const { friendID } = req.body;
    const user = await User.findById(req.user.id);
    const friend = await User.findById(friendID);
    if (!friend)
      return res.status(404).json({ error: "Friend user not found" });
    if (friend.friendRequests.includes(user._id))
      return res.status(400).json({ error: "Friend request already sent" });
    friend.friendRequests.push(user._id);
    await friend.save();
    // Target the friend to refresh their friend requests.
    sendToUser(friendID, { type: "UPDATE_DATA", update: "friends" });
    res.json({ message: "Friend request sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List friend requests for the current user
router.get("/friends/requests", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("friendRequests");
    res.json(user.friendRequests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete (decline) a friend request
router.delete("/friends/request", verifyToken, async (req, res) => {
  try {
    const { friendID } = req.body;
    const user = await User.findById(req.user.id);
    user.friendRequests = user.friendRequests.filter(
      (id) => id.toString() !== friendID.toString()
    );
    await user.save();
    res.json({ message: "Friend request removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept a friend request
router.post("/friends/accept", verifyToken, async (req, res) => {
  try {
    const { friendID } = req.body;
    const user = await User.findById(req.user.id);
    const friend = await User.findById(friendID);
    if (!friend) return res.status(404).json({ error: "User not found" });
    // Remove friend request and add to friend lists if not already present
    user.friendRequests = user.friendRequests.filter(
      (id) => id.toString() !== friendID.toString()
    );
    if (!user.friends.includes(friendID)) user.friends.push(friendID);
    if (!friend.friends.includes(req.user.id)) friend.friends.push(req.user.id);
    await user.save();
    await friend.save();
    // Target both users to update their friend lists.
    sendToUsers([req.user.id, friendID], {
      type: "UPDATE_DATA",
      update: "friends",
    });
    res.json({ message: "Friend request accepted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get friend list for the current user
router.get("/friends", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("friends");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ---------------------
  Chat Endpoints
  ---------------------
*/

// Explicitly create a new chat (optional, since sendMessage auto-creates a chat if needed)
router.post("/chat/create", verifyToken, async (req, res) => {
  try {
    const { recipientID } = req.body;
    const chat = new ChatLog({ participants: [req.user.id, recipientID] });
    await chat.save();
    res.status(201).json(chat.toJSON());
    // Target both participants to update their chat lists.
    sendToUsers([req.user.id, recipientID], {
      type: "UPDATE_DATA",
      update: "chats",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all chats for the current user
router.get("/chats", verifyToken, async (req, res) => {
  try {
    const chats = await ChatLog.find({ participants: req.user.id }).populate(
      "participants"
    );
    res.json(chats.map((chat) => chat.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Find a chat with a specific user
router.get("/chat/:userId", verifyToken, async (req, res) => {
  try {
    const chat = await ChatLog.findOne({
      participants: { $all: [req.user.id, req.params.userId] },
    }).populate("participants");
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json(chat.toJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat/send", verifyToken, async (req, res) => {
  try {
    const { recipientID, text } = req.body;
    if (!recipientID || !text) {
      throw new Error("Missing recipientID or text in request body");
    }
    let chat = await ChatLog.findOne({
      participants: { $all: [req.user.id, recipientID] },
    });
    if (!chat) {
      chat = new ChatLog({ participants: [req.user.id, recipientID] });
      await chat.save();
    }
    await chat.addMessage(req.user.id, recipientID, text);
    // Notify both the sender and recipient to update their chats.
    sendToUsers([req.user.id, recipientID], {
      type: "UPDATE_DATA",
      update: "chats",
    });
    res.json({ message: "Message sent", chat: chat.toJSON() });
  } catch (err) {
    console.error("Error in /api/chat/send:", err);
    res.status(500).json({ error: err.message });
  }
});

// Retrieve decrypted messages for a specific chat.
router.get("/chat/messages/:chatId", verifyToken, async (req, res) => {
  try {
    const chat = await ChatLog.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    const messages = chat.getDecryptedMessages();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific message from a chat.
router.delete(
  "/chat/message/:chatId/:messageId",
  verifyToken,
  async (req, res) => {
    try {
      const { chatId, messageId } = req.params;
      const chat = await ChatLog.findById(chatId);
      if (!chat) return res.status(404).json({ error: "Chat not found" });
      await chat.deleteMessage(messageId);
      // Notify the other participant(s)
      chat.participants.forEach((participant) => {
        if (participant.toString() !== req.user.id) {
          sendToUser(participant.toString(), {
            type: "UPDATE_DATA",
            update: "chats",
          });
        }
      });
      res.json({ message: "Message deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Edit a message in a chat.
router.put(
  "/chat/message/:chatId/:messageId",
  verifyToken,
  async (req, res) => {
    try {
      const { chatId, messageId } = req.params;
      const { newText } = req.body;
      const chat = await ChatLog.findById(chatId);
      if (!chat) return res.status(404).json({ error: "Chat not found" });
      await chat.editMessage(messageId, newText);
      // Notify the other participant(s)
      chat.participants.forEach((participant) => {
        if (participant.toString() !== req.user.id) {
          sendToUser(participant.toString(), {
            type: "UPDATE_DATA",
            update: "chats",
          });
        }
      });
      res.json({ message: "Message edited" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete an entire chat.
router.delete("/chat/:chatId", verifyToken, async (req, res) => {
  try {
    const chat = await ChatLog.findByIdAndDelete(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    // Notify all participants of the deletion.
    chat.participants.forEach((participant) => {
      sendToUser(participant.toString(), {
        type: "UPDATE_DATA",
        update: "chats",
      });
    });
    res.json({ message: "Chat deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
