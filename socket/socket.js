const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

let io;

const ROLE_MODEL_MAP = {
  admin: "Admin",
  shopkeeper: "User",
  customer: "Customer",
  student: "Student",
};

function setupSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Token required"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
     
      socket.user = decoded;
      next();
      
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const { id, _id, role: rawRole } = socket.user;
    const userId = id || _id;
    const role = rawRole ? rawRole.toLowerCase() : null;
    console.log(`${role || "unknown"} connected: ${userId}`);

    if (userId) {
      socket.join(`user:${userId}`);
    }
    if (role) {
      socket.join(`role:${role}`);
    }

    
    // Case-insensitive role matching for notifications
    const roleCapitalized = role ? role.charAt(0).toUpperCase() + role.slice(1) : null;
    const roleModel = role ? ROLE_MODEL_MAP[role] : null;

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

    const notifs = filters.length
      ? await Notification.find({ $or: filters })
          .sort({ createdAt: -1 })
          .limit(10)
      : [];

    socket.emit("notification:batch", notifs);

    socket.on("notification:read", async (notifId) => {
      if (!userId) return;
      await Notification.updateOne(
        { _id: notifId, "isReadBy.userId": { $ne: userId } },
        { $push: { isReadBy: { userId, readAt: new Date() } } }
      );
    });

    socket.on("disconnect", () => {
      console.log(` ${role || "unknown"} disconnected: ${userId}`);
    });
  });

  console.log("Socket.IO setup complete");
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
}

module.exports = { setupSocket, getIO };
