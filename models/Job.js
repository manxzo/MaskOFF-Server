const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAuth",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    contractPeriod: {
      type: Number,
      required: true,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// virtual transform: rename _id to jobID and remove __v
jobSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.jobID = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
jobSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Job", jobSchema);
