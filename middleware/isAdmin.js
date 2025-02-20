const User = require("../models/User");
const jwt = require("jsonwebtoken");

const isAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken;
    if (!token) {
      console.log("No admin token found");
      return res.redirect("/admin/login");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // find user & check if admin
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      console.log("User not found for token");
      return res.redirect("/admin/login");
    }

    if (user.role !== "admin") {
      console.log("User is not an admin:", user.role);
      return res.redirect("/admin/login");
    }

    // attach user to request
    req.admin = user;
    next();
  } catch (error) {
    console.error("isAdmin middleware error:", error);
    return res.redirect("/admin/login");
  }
};

module.exports = isAdmin;
