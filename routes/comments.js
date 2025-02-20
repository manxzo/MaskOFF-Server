const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const { verifyToken } = require("../components/jwtUtils");

/**
 * Create a new comment on a post
 * POST /api/posts/:postId/comments
 * Requires authentication
 */
router.post("/posts/:postId/comments", verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.postId;

    // Validate comment content
    if (!content) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    // Create and save the new comment
    const comment = new Comment({
      content,
      author: req.user.id, // From JWT token
      post: postId,
    });
    await comment.save();

    // Add the comment reference to the parent post
    const post = await Post.findById(postId);
    post.comments.push(comment._id);
    await post.save();

    // Return the updated post with populated comments and authors
    const updatedPost = await Post.findById(postId)
      .populate("author", "username")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "username",
        },
      });

    res.status(201).json(updatedPost);
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

/**
 * Get all comments for a specific post
 * GET /api/posts/:postId/comments
 * Requires authentication
 */
router.get("/posts/:postId/comments", verifyToken, async (req, res) => {
  try {
    // Find all comments for the post, populate author details, and sort by newest first
    const comments = await Comment.find({ post: req.params.postId })
      .populate("author", "username")
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

/**
 * Delete a specific comment from a post
 * DELETE /api/posts/:postId/comments/:commentId
 * Requires authentication and comment ownership
 */
router.delete(
  "/posts/:postId/comments/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const comment = await Comment.findById(req.params.commentId);

      // Check if comment exists
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      // Verify comment ownership
      if (comment.author.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this comment" });
      }

      // Remove the comment reference from the post
      await Post.findByIdAndUpdate(req.params.postId, {
        $pull: { comments: comment._id },
      });

      // Delete the comment
      await comment.deleteOne();
      res.json({ message: "Comment deleted successfully" });
    } catch (err) {
      console.error("Delete comment error:", err);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  }
);

module.exports = router;
