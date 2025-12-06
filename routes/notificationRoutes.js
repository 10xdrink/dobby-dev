const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const ROLE_MODEL_MAP = {
  admin: "Admin",
  shopkeeper: "User",
  customer: "Customer",
  student: "Student",
};


router.use((req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
});

// Get all notifications
router.get("/", async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const role = req.user?.role;

  // Case-insensitive role matching for notifications
  const roleCapitalized = role ? role.charAt(0).toUpperCase() + role.slice(1) : null;
  const roleModel = role ? ROLE_MODEL_MAP[role.toLowerCase()] : null;

  const filters = [];

  if (role) {
    filters.push({ targetModels: { $in: [roleCapitalized, role] } });
  }

  if (userId) {
    const castedId =
      mongoose.Types.ObjectId.isValid(userId) && typeof userId !== "object"
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    const elemMatch = { userId: castedId };
    if (roleModel) {
      elemMatch.userModel = roleModel;
    }

    filters.push({ targetUsers: { $elemMatch: elemMatch } });
  }

  if (!filters.length) {
    return res.json({ notifications: [] });
  }

  const notifications = await Notification.find({ $or: filters })
    .sort({ createdAt: -1 })
    .limit(30);

  res.json({ notifications });
});

// Mark notification as read
router.post("/:id/read", async (req, res) => {
  const { id: userId } = req.user;
  await Notification.updateOne(
    { _id: req.params.id, "isReadBy.userId": { $ne: userId } },
    { $push: { isReadBy: { userId, readAt: new Date() } } }
  );
  res.json({ success: true });
});

module.exports = router;
