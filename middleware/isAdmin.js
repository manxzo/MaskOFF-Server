const User = require("../models/User");
const jwt = require("jsonwebtoken");

const isAdmin = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies.adminToken;

    if (!token) {
      return res.redirect("/admin/login");
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and check if admin
    const user = await User.findById(decoded.id);

    if (!user || user.role !== "admin") {
      return res.redirect("/admin/login");
    }

    // Attach user to request
    req.admin = user;
    next();
  } catch (error) {
    return res.redirect("/admin/login");
  }
};

module.exports = isAdmin;
