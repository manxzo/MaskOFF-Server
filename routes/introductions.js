const express = require("express");
const router = express.Router();
const Introduction = require("../models/Introduction");
const { verifyToken } = require("../components/jwtUtils");

// Create a new introduction
router.post("/introduction", verifyToken, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const introduction = new Introduction({
      content,
      author: req.user.id,
    });

    await introduction.save();
    res.status(201).json(introduction);
  } catch (err) {
    console.error("Create introduction error:", err);
    res.status(500).json({ error: "Failed to create introduction" });
  }
});

// Get all introductions
router.get("/introductions", verifyToken, async (req, res) => {
  try {
    const introductions = await Introduction.find()
      .sort({ createdAt: -1 })
      .limit(50); // Limit to most recent 50 introductions

    res.json(introductions);
  } catch (err) {
    console.error("Get introductions error:", err);
    res.status(500).json({ error: "Failed to fetch introductions" });
  }
});

module.exports = router;
