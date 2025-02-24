const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const SALT_ROUNDS = 10;

// subdocument schema for storing friend info (userID + username)
const friendSubSchema = new mongoose.Schema(
  {
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAuth",
      required: true,
    },
    username: { type: String, required: true },
  },
  { _id: false }
);

const UserAuthSchema = new mongoose.Schema(
  {
    // single name field
    name: { type: String, required: true, trim: true },

    dob: { type: Date, required: true },

    email: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },

    password: {
      type: String,
      required: true,
      minlength: 8,
    },

    // email & pw reset
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    // friend relationships (optional)
    friendRequestsSent: { type: [friendSubSchema], default: [] },
    friendRequestsReceived: { type: [friendSubSchema], default: [] },
    friends: { type: [friendSubSchema], default: [] },
    avatar:{
      data:Buffer,
      contentType:String,
    }
  },
  { timestamps: true }
);

// hash password if modified
UserAuthSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  }
  next();
});

// compare provided password with stored hash
UserAuthSchema.methods.isCorrectPassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// generate verification token for email verification
UserAuthSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(20).toString("hex");
  this.verificationToken = token;
  return token;
};

// generate reset password token (with expiration)
UserAuthSchema.methods.generateResetPasswordToken = function () {
  const token = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = token;
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  return token;
};

// virtual: expose friendly userID in JSON
UserAuthSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.userID = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.resetPasswordExpires;
    delete ret.resetPasswordToken;
    delete ret.verificationToken;
    return ret;
  },
});
UserAuthSchema.methods.toPublicProfile = function() {
  const ret = this.toObject({ virtuals: true });
    ret.userID = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.resetPasswordExpires;
    delete ret.resetPasswordToken;
    delete ret.verificationToken;
    delete ret.email;
    delete ret.dob
    delete ret.friendRequestsReceived;
    delete ret.friendRequestsSent;
    return ret;
  };
UserAuthSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("UserAuth", UserAuthSchema);
