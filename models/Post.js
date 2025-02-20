const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Post schema
const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    //postType distinguish between 'community' and 'job' posts
    postType: {
      type: String,
      enum: ["community", "job"],
      default: "community",
    },
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// JSON transformation; add postID, remove _id and __v
postSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.postID = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Add indexes for better query performance
postSchema.index({ createdAt: -1 });
postSchema.index({ postType: 1 });
postSchema.index({ author: 1 });

module.exports = mongoose.model("Post", postSchema);
