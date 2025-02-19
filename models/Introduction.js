const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const introductionSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// JSON transformation: add introID, remove _id and __v
introductionSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.introID = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Add index for better query performance
introductionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Introduction", introductionSchema);
