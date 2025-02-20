const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const isAdmin = require("../middleware/isAdmin");
const csrf = require("csurf");

//CSRF protection middleware
const csrfProtection = csrf({ cookie: true });

//login page
router.get("/login", csrfProtection, (req, res) => {
  res.render("admin/login", { csrfToken: req.csrfToken() });
});

//login handler
router.post("/login", csrfProtection, async (req, res) => {
  try {
    const { username, password } = req.body;
    //find user
    const user = await User.findOne({ username });
    //debug
    console.log("Login attempt:", {
      username,
      userFound: !!user,
      role: user?.role,
    });

    if (!user || user.role !== "admin") {
      console.log("Login failed: Invalid user or not admin");
      return res.render("admin/login", {
        error: "Invalid credentials",
        csrfToken: req.csrfToken(),
      });
    }

    //verify pw
    const isValid = await user.isCorrectPassword(password);
    console.log("Password validation:", { isValid });

    if (!isValid) {
      console.log("Login failed: Invalid password");
      return res.render("admin/login", {
        error: "Invalid credentials",
        csrfToken: req.csrfToken(),
      });
    }

    //generate token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    //set cookie
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    res.render("admin/login", {
      error: "An error occurred",
      csrfToken: req.csrfToken(),
    });
  }
});

//dashboard
router.get("/dashboard", isAdmin, csrfProtection, async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.render("admin/dashboard", {
      users,
      currentUser: req.admin,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).send("Server error");
  }
});

//edit user page
router.get("/users/:id/edit", isAdmin, async (req, res) => {
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

//update user
router.post("/users/:id/edit", isAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.redirect("/admin/dashboard");
    }

    //check if username is changed + verify it's not taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.redirect("/admin/dashboard");
      }
      user.username = username;
    }

    let shouldLogout = false;
    // only update password if one was provided
    if (password && password.trim() !== "") {
      user.password = password;
      // check if user edited is currently logged in admin
      if (user._id.toString() === req.admin.id) {
        shouldLogout = true;
      }
    }

    user.role = role;
    await user.save();

    if (shouldLogout) {
      // clear admin token + redirect login
      res.clearCookie("adminToken");
      return res.redirect("/admin/login");
    }

    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Error updating user:", error);
    res.redirect("/admin/dashboard");
  }
});

//delete handlers
router.post("/users/:id/delete", isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect("/admin/dashboard");
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

//logout
router.post("/logout", (req, res) => {
  res.clearCookie("adminToken");
  res.redirect("/admin/login");
});

module.exports = router;
