const Notification = require("../models/Notification");
const { getIO } = require("../socket/socket");

exports.createAndEmitNotification = async ({
  title,
  message,
  event,
  targetModels = [],
  targetUsers = [],
  meta = {},
}) => {
  try {
    const io = getIO();

    console.log(`[NOTIFICATION] Creating notification: "${title}"`);
    console.log(`[NOTIFICATION] Event: ${event}`);
    console.log(`[NOTIFICATION] Target Models (roles):`, targetModels);
    console.log(`[NOTIFICATION] Target Users (specific IDs):`, targetUsers.map(u => ({ userId: u.userId?.toString(), userModel: u.userModel })));
    
    const notif = await Notification.create({
      title,
      message,
      event,
      targetModels,
      targetUsers,
      meta,
    });

 
    targetModels.forEach((role) => {
      if (role) {
          console.log(`[NOTIFICATION] Emitting '${title}' to role:${role.toLowerCase()} (ALL users with this role)`);
          io.to(`role:${role.toLowerCase()}`).emit("notification:new", notif);
      }
    });

   
    targetUsers.forEach(({ userId }) => {
      if (userId) {
          console.log(`[NOTIFICATION] Emitting '${title}' to user:${userId.toString()} (SPECIFIC user only)`);
          io.to(`user:${userId.toString()}`).emit("notification:new", notif);
      }
    });

    console.log(`[NOTIFICATION]  Notification emitted successfully: ${title}`);
    return notif;
  } catch (err) {
    console.error("[NOTIFICATION]  Notification emit error:", err);
  }
};

