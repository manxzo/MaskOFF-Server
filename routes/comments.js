const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const { verifyToken } = require("../components/jwtUtils");


router.post("/posts/:postId/comments", verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.postId;
    // validation comment content
    if (!content) {
      return res.status(400).json({ error: "Comment content is required" });
    }
    //new commend create+save
    const comment = new Comment({
      content,
      author: req.user.id, //frm JWT tok
      post: postId,
    });
    await comment.save();
    //comment ref to parent post
    const post = await Post.findById(postId);
    post.comments.push(comment._id);
    await post.save();
    //return updated post w/ populated comments + authors
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

router.get("/posts/:postId/comments", verifyToken, async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate("author", "username")
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.delete(
  "/posts/:postId/comments/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      if (comment.author.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this comment" });
      }
      await Post.findByIdAndUpdate(req.params.postId, {
        $pull: { comments: comment._id },
      });
      await comment.deleteOne();
      res.json({ message: "Comment deleted successfully" });
    } catch (err) {
      console.error("Delete comment error:", err);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  }
);

module.exports = router;
