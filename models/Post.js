const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserAuth",
    required: true,
  },
  author:{type:String,required:true},
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  // optional anonymous info for comments:
  anonymousInfo: {
    anonymousIdentity: { type: String },
    details: { type: String },
  },
});

// you can add custom method on the comment schema also (if want to hide the real user info)
commentSchema.methods.toPublic = function() {
  const ret = this.toObject({ virtuals: true });
  // if comment posted anonymously (assuming we pass `isAnonymous` flag together with comment data),
  // then expose only the anonymous info
  ret.commentID = ret._id
  if (ret.anonymousInfo && ret.anonymousInfo.anonymousIdentity) {
    // remove the actual user field
    ret.user = undefined;
    return {
      ...ret,
      user: {
        anonymousIdentity: ret.anonymousInfo.anonymousIdentity,
        details: ret.anonymousInfo.details || "",
      },
    };
  } else {
    // otherwise, return user id and assume that the caller populated it
    return ret;
  }
};

// consolidated Post schema
const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAuth",
      required: true,
    },
    isAnonymous: { type: Boolean, default: false },
    author: { type: String, required: true },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    upvotedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "UserAuth",
      default: [],
    },
    downvotedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "UserAuth",
      default: [],
    },
    comments: [commentSchema],
    // field to store anonymous identity & details if post is anonymous
    anonymousInfo: {
      anonymousIdentity: { type: String },
      details: { type: String },
    },
  },
  { timestamps: true }
);

// custom method to output public version of a post
postSchema.methods.toPublic = function() {
  const ret = this.toObject({ virtuals: true });
  ret.postID = ret._id;  
  // remove mongo-specific fields
  delete ret.__v;
  delete ret._id;
  
  // depending on anonymity, set the user field accordingly
  if (ret.isAnonymous) {
    // if post is anonymous, don't reveal the real user info
    ret.user = {
      // show only anonymous info; if not set, provide fallback
      anonymousIdentity: ret.anonymousInfo?.anonymousIdentity || "Anonymous",
      details: ret.anonymousInfo?.details || "",
    };
  } else {
    // non-anonymous posts: assume user field is populated
    // expose the user's id + username
    ret.user = {
      userID: ret.user._id ? ret.user._id : ret.user, // if populated, ret.user._id is available
      username: ret.user.username,
    };
  }
  
  // optionally, remove anonymousInfo field from output
  delete ret.anonymousInfo;
  return ret;
};

postSchema.set("toJSON", { virtuals: true });
postSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Post", postSchema);
