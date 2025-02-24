const express = require("express");
const router = express.Router();
const UserAuth = require("../models/UserAuth");
const UserProfile = require("../models/UserProfile");
const { generateToken, verifyToken } = require("../components/jwtUtils");
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { sendToAll } = require("../components/wsUtils");
// MailerSend-based email utility functions
const { sendVerificationEmail, sendForgotPasswordEmail } = require("../components/emailUtils");

// registration: create UserAuth and its UserProfile, then send verification email
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      dob,
      email,
      username,
      password,
      confirmPassword,
      anonymousIdentity // required for maskOFF identity
    } = req.body;

    // validate all required fields
    if (!name || !dob || !email || !username || !password || !confirmPassword || !anonymousIdentity) {
      return res.status(400).json({ error: "All required fields must be provided." });
    }

    // check password match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }
    if (password.length<8) {
      return res.status(400).json({ error: "Password too short." });
    }
    // check age >= 16
    const dateOfBirth = new Date(dob);
    if (isNaN(dateOfBirth.getTime())) {
      return res.status(400).json({ error: "Invalid date of birth format." });
    }
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setFullYear(now.getFullYear() - 16);
    if (dateOfBirth > cutoffDate) {
      return res.status(400).json({ error: "You must be at least 16 years old to register." });
    }

    // check for duplicates
    const emailExists = await UserAuth.findOne({ email });
    if (emailExists) {
      return res.status(409).json({ error: "Email already in use." });
    }
    const usernameExists = await UserAuth.findOne({ username });
    if (usernameExists) {
      return res.status(409).json({ error: "Username already taken." });
    }
    const anonymousIdentityExists = await UserProfile.findOne({ 'anonymousInfo.anonymousIdentity': anonymousIdentity });
    if (anonymousIdentityExists) {
      return res.status(409).json({ error: "This MaskOFF ID is already taken." });
    }

    // create user
    const newUserAuth = new UserAuth({
      name,
      dob: dateOfBirth,
      email,
      username,
      password
    });
    newUserAuth.generateVerificationToken(); // generate a verification token
    await newUserAuth.save();

    // create profile
    // only anonymousIdentity is mandatory for "anonymousInfo"
    const newUserProfile = new UserProfile({
      user: newUserAuth._id,
      anonymousInfo: {
        anonymousIdentity
      }
      // publicInfo, etc. remain optional
    });
    await newUserProfile.save();

    // send verification email
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?userID=${newUserAuth._id}&verifytoken=${newUserAuth.verificationToken}`;
    await sendVerificationEmail({
      to: newUserAuth.email,
      toName: newUserAuth.name,
      username: newUserAuth.username,
      verifyUrl: verificationUrl,
      supportEmail: process.env.SUPPORT_EMAIL || "support@domain.com",
    });
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    return res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      user: {
        ...newUserAuth.toJSON(),
        profile: newUserProfile.toJSON()
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// email verification route
router.get("/verify-email", async (req, res) => {
  const { userID, token } = req.query;
  if (!userID || !token) {
    return res.status(400).json({ error: "Missing parameters." });
  }
  try {
    const user = await UserAuth.findById(userID);
    if (!user) return res.status(404).json({ error: "User not found." });

    if (user.emailVerified) {
      return res.json({ message: "Email verified." });
    }

    if (user.verificationToken !== token) {
      return res.status(400).json({ error: "Invalid verification token." });
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Email verified successfully." });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================== Forgot Password & Reset Password ==================

// req password reset
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const user = await UserAuth.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found." });

    // generate reset token
    const resetToken = user.generateResetPasswordToken();
    await user.save();

    // construct pw reset URL
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?userID=${user._id}&token=${resetToken}&username=${user.username}`;

    // updated: use user.name (not user.firstName) since our schema has "name"
    await sendForgotPasswordEmail({
      to: user.email,
      toName: user.name,
      username: user.username,
      resetUrl,
      supportEmail: process.env.SUPPORT_EMAIL || "support@domain.com",
    });

    res.json({ message: "Password reset instructions have been sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// reset password: set new password using token
router.post("/reset-password", async (req, res) => {
  const { userID, token, newPassword, confirmNewPassword } = req.body;
  if (!userID || !token || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: "Missing parameters." });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  try {
    const user = await UserAuth.findById(userID);
    if (!user) return res.status(404).json({ error: "User not found." });
    // check if token is valid && not expired
    if (user.resetPasswordToken !== token || Date.now() > user.resetPasswordExpires) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }
    // update password (it will be hashed in the pre-save hook)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Login, Get User, Update Profile, List Users ==========

// login route
router.post("/users/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await UserAuth.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (!(await user.isCorrectPassword(password))) return res.status(401).json({ error: "Invalid credentials." });

    const token = generateToken(user);
    // fetch user profile
    const profile = await UserProfile.findOne({ user: user._id });
    res.json({ token, user: { ...user.toJSON(), profile: profile ? profile.toJSON() : {} } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get user details (combined auth & profile)
router.get("/user/:userID", verifyToken, async (req, res) => {
  try {
    const user = await UserAuth.findById(req.params.userID);
    if (!user) return res.status(404).json({ error: "user not found." });
    const profile = await UserProfile.findOne({ user: user._id });
    let userJson = user.toJSON();
    // remove extra '/api' if APP_URL already includes it
    userJson.avatar = `${`${process.env.APP_URL}/api` || "http://localhost:3000/api"}/avatar/${userJson.userID}`;
    res.json({ ...userJson, profile: profile ? profile.toJSON() : {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// update profile (optional update of public/anonymous info)
router.put("/profile/:userID", verifyToken, async (req, res) => {
  try {
    const { publicInfo, anonymousInfo } = req.body;
    const profile = await UserProfile.findOneAndUpdate(
      { user: req.params.userID },
      { publicInfo, anonymousInfo },
      { new: true }
    );
    if (!profile) return res.status(404).json({ error: "Profile not found." });
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Profile updated", profile: profile.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// update avatar route
router.post("/upload-avatar", verifyToken, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // read file data from temp storage
    const imgData = fs.readFileSync(req.file.path);
    const contentType = req.file.mimetype;

    // use the authenticated user's ID from req.user (set by verifyToken)
    const user = await UserAuth.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    // update the avatar field with the new image Buffer and content type
    user.avatar = { data: imgData, contentType };
    await user.save();

    // remove the temporary file
    fs.unlinkSync(req.file.path);
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Avatar uploaded successfully." });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/avatar/:userID", async (req, res) => {
  try {
    const user = await UserAuth.findById(req.params.userID);
    if (user && user.avatar && user.avatar.data) {
      res.set("Content-Type", user.avatar.contentType);
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      return res.send(user.avatar.data);
    } else {
      return res.status(404).json({ error: "No avatar found." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get list of all users (basic public information)
router.get("/users", async (req, res) => {
  try {
    // retrieve all users from the authentication collection
    const users = await UserAuth.find({});
    // for each user, build a public object with an avatar URL if avail
    const userList = users.map(user => {
      const avatarUrl = (user.avatar && user.avatar.data)
        ? `${`${process.env.APP_URL}/api` || "http://localhost:3000/api"}/avatar/${user._id}`
        : null;
      return {
        userID: user._id,
        username: user.username,
        name: user.name,
        avatar: avatarUrl,
      };
    });
    res.json({ users: userList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get user by username (public profile)
router.get("/user/by-username/:username", async (req, res) => {
  try {
    const user = await UserAuth.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "user not found" });
    const profile = await UserProfile.findOne({ user: user._id });
    const avatarUrl = (user.avatar && user.avatar.data)
    ? `${`${process.env.APP_URL}/api` || "http://localhost:3000/api"}/avatar/${user._id}`
    : null;
    res.json({
      user:user? {...user.toPublicProfile(),avatar:avatarUrl} : {},
      profile: profile ? profile.toPublicProfile() : {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
