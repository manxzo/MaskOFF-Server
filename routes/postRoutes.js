const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const UserProfile = require("../models/UserProfile");
const { verifyToken } = require("../components/jwtUtils");
const UserAuth = require("../models/UserAuth");
const { sendToAll } = require("../components/wsUtils");
// new post
router.post("/posts", verifyToken, async (req, res) => {
  try {
    const { content, tags, isAnonymous } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required." });
    }

    // fetch both the user auth info and profile concurrently
    const [user, profile] = await Promise.all([
      UserAuth.findById(req.user.id),
      UserProfile.findOne({ user: req.user.id }),
    ]);

    if (!user || !profile) {
      return res.status(404).json({ error: "User not found." });
    }

    let author;
    let anonymousInfo = null;
    if (isAnonymous) {
      // use anonymous identity and details from profile
      author = profile.anonymousInfo.anonymousIdentity;
      anonymousInfo = {
        anonymousIdentity: profile.anonymousInfo.anonymousIdentity,
        details: profile.anonymousInfo.details,
      };
    } else {
      // use the user's real username
      author = user.username;
    }

    const newPost = new Post({
      user: req.user.id,
      author,
      content,
      tags,
      isAnonymous: isAnonymous || false,
      anonymousInfo,
    });

    await newPost.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res
      .status(201)
      .json({ message: "Post created successfully.", post: newPost.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get all posts with proper profile info based on anonymity
router.get("/posts", async (req, res) => {
  try {
    // get all posts and populate "user" field with username
    const posts = await Post.find().populate("user", "username");

    // convert each post (and its comments) using custom toPublic method
    const publicPosts = posts.map((post) => {
      // map each comment using its toPublic method (or fallback to toJSON).
      const publicComments = post.comments.map((comment) =>
        typeof comment.toPublic === "function" ? comment.toPublic() : comment.toObject()
      );
      // convert the post to its public version
      const publicPost =
        typeof post.toPublic === "function" ? post.toPublic() : post.toObject();
      return {
        ...publicPost,
        comments: publicComments,
      };
    });

    res.json({ posts: publicPosts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get 1 post by postID with proper profile info
router.get("/posts/:postID", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postID).populate("user", "username");
    if (!post) return res.status(404).json({ error: "Post not found." });
    res.json({ post: post.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// update post
router.put("/posts/:postID", verifyToken, async (req, res) => {
  try {
    const { postID } = req.params;
    const { content, tags, isAnonymous } = req.body;
    const post = await Post.findById(postID);
    if (!post) return res.status(404).json({ error: "Post not found." });
    // optionally: check if req.user.id matches post.user

    post.content = content || post.content;
    post.tags = tags || post.tags;
    if (typeof isAnonymous !== "undefined") {
      post.isAnonymous = isAnonymous;
      if (isAnonymous) {
        const profile = await UserProfile.findOne({ user: req.user.id });
        if (profile) {
          post.author = profile.anonymousInfo.anonymousIdentity;
          post.anonymousInfo = {
            anonymousIdentity: profile.anonymousInfo.anonymousIdentity,
            details: profile.anonymousInfo.details,
          };
        }
      } else {
        const user = await UserAuth.findById(req.user.id);
        if (user) {
          post.author = user.username;
          post.anonymousInfo = null;
        }
      }
    }
    await post.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Post updated", post: post.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete post
router.delete("/posts/:postID", verifyToken, async (req, res) => {
  try {
    const { postID } = req.params;
    const post = await Post.findByIdAndDelete(postID);
    if (!post) return res.status(404).json({ error: "Post not found." });
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// add comment to 1 post (with optional anonymous info)
router.post("/posts/:postID/comments", verifyToken, async (req, res) => {
  try {
    const { postID } = req.params;
    const { content, isAnonymous } = req.body;
    if (!content)
      return res.status(400).json({ error: "Comment content is required." });
    const post = await Post.findById(postID);
    if (!post) return res.status(404).json({ error: "Post not found." });

    let commentData = { user: req.user.id, content };

    if (isAnonymous) {
      const profile = await UserProfile.findOne({ user: req.user.id });
      const user = await UserAuth.findById(req.user.id);
      if (profile && user) {
        commentData = {
          ...commentData,
          author:profile.anonymousInfo.anonymousIdentity,
          anonymousInfo: {
            anonymousIdentity: profile.anonymousInfo.anonymousIdentity,
            details: profile.anonymousInfo.details,
          },
        };
      }
    }
    else {
     
      const user = await UserAuth.findById(req.user.id);
      if (user) {
        commentData = {
          ...commentData,
          author:user.username, 
        };
      }
    }

    post.comments.push(commentData);
    await post.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.status(201).json({ message: "Comment added", post: post.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// upvote post
router.post("/posts/:postID/upvote", verifyToken, async (req, res) => {
  try {
    const { postID } = req.params;
    const post = await Post.findById(postID);
    if (!post) return res.status(404).json({ error: "Post not found." });
    const userId = req.user.id;

    // remove user from downvotedBy if present
    if (post.downvotedBy && post.downvotedBy.includes(userId)) {
      post.downvotedBy = post.downvotedBy.filter(
        (id) => id.toString() !== userId.toString()
      );
    }
    // toggle upvote
    if (post.upvotedBy && post.upvotedBy.includes(userId)) {
      post.upvotedBy = post.upvotedBy.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      post.upvotedBy.push(userId);
    }
    await post.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Upvote processed", post: post.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// downvote a post
router.post("/posts/:postID/downvote", verifyToken, async (req, res) => {
  try {
    const { postID } = req.params;
    const post = await Post.findById(postID);
    if (!post) return res.status(404).json({ error: "Post not found." });
    const userId = req.user.id;

    // remove from upvotedBy if exists
    if (post.upvotedBy && post.upvotedBy.includes(userId)) {
      post.upvotedBy = post.upvotedBy.filter(
        (id) => id.toString() !== userId.toString()
      );
    }
    // toggle downvote
    if (post.downvotedBy && post.downvotedBy.includes(userId)) {
      post.downvotedBy = post.downvotedBy.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      post.downvotedBy.push(userId);
    }
    await post.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Downvote processed", post: post.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
