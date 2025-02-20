const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Comment Schema
 * Represents a comment on a post with author reference and timestamps
 */
const commentSchema = new Schema(
  {
    // The actual comment text
    content: {
      type: String,
      required: true,
      trim: true,
    },
    // Reference to the User who created the comment
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Reference to the Post this comment belongs to
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Transform the document when converting to JSON
// Adds commentID and removes MongoDB-specific fields
commentSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.commentID = ret._id; // Add a more friendly ID field
    delete ret._id; // Remove MongoDB's _id
    delete ret.__v; // Remove version key
    return ret;
  },
});

module.exports = mongoose.model("Comment", commentSchema);
