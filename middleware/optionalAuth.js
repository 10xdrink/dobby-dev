const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");
const Student = require("../models/student");
const User = require("../models/User");

exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Use decoded.id (not _id) and check role
      const userId = decoded.id || decoded._id;
      const role = decoded.role;
      
      // Find user based on their role
      if (role === 'student') {
        req.user = await Student.findById(userId).select("-password");
      } else if (role === 'customer') {
        req.user = await Customer.findById(userId).select("-password");
      } else {
        // Default fallback to User model
        req.user = await User.findById(userId).select("-password");
      }
      
      // If user not found in database, use decoded token data directly
      if (!req.user) {
        req.user = { _id: userId, id: userId, role, email: decoded.email };
      }
    } catch (err) {
      // invalid token → guest continue
      req.user = null;
    }
  }
  next();
};
