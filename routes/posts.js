const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const { verifyToken } = require("../components/jwtUtils");

router.post("/posts", verifyToken, async (req, res) => {
  try {
    const { title, content, postType } = req.body;

    if (!title || !content || !postType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const post = new Post({
      title,
      content,
      author: req.user.id,
      postType,
    });
    await post.save();
    await post.populate("author", "username");
    res.status(201).json(post);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.get("/posts", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "author",
        select: "username",
        options: { lean: true },
      })
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "username",
          options: { lean: true },
        },
      });
    const validPosts = posts.filter((post) => post.author);
    res.json(validPosts);
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.get("/posts/:postId", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate("author", "username")
      .populate("comments.author", "username");

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(post);
  } catch (err) {
    console.error("Get post error:", err);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

router.put("/posts/:postId", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (post.author.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this post" });
    }
    const { title, content } = req.body;
    post.title = title || post.title;
    post.content = content || post.content;
    await post.save();
    await post.populate("author", "username");
    res.json(post);
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
});

router.delete("/posts/:postId", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (post.author.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this post" });
    }
    await post.deleteOne();
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

module.exports = router;
