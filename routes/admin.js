const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const isAdmin = require("../middleware/isAdmin");
const csrf = require("csurf");

// CSRF protection middleware
const csrfProtection = csrf({ cookie: true });

// Login page
router.get("/login", csrfProtection, (req, res) => {
  res.render("admin/login", { csrfToken: req.csrfToken() });
});

// Login handler
router.post("/login", csrfProtection, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });

    if (!user || user.role !== "admin") {
      return res.render("admin/login", {
        error: "Invalid credentials",
        csrfToken: req.csrfToken(),
      });
    }

    // Verify password
    const isValid = await user.isCorrectPassword(password);
    if (!isValid) {
      return res.render("admin/login", {
        error: "Invalid credentials",
        csrfToken: req.csrfToken(),
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Set cookie
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.redirect("/admin/dashboard");
  } catch (error) {
    res.render("admin/login", {
      error: "An error occurred",
      csrfToken: req.csrfToken(),
    });
  }
});

// Dashboard
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.render("admin/dashboard", { users, admin: req.admin });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// Edit user page
router.get("/edit-user/:id", isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.redirect("/admin/dashboard");
    }
    res.render("admin/edit-user", { user, admin: req.admin });
  } catch (error) {
    res.redirect("/admin/dashboard");
  }
});

// Update user
router.post("/edit-user/:id", isAdmin, async (req, res) => {
  try {
    const { username, role } = req.body;
    await User.findByIdAndUpdate(req.params.id, { username, role });
    res.redirect("/admin/dashboard");
  } catch (error) {
    res.redirect("/admin/dashboard");
  }
});

// Logout
router.get("/logout", (req, res) => {
  res.clearCookie("adminToken");
  res.redirect("/admin/login");
});

module.exports = router;
