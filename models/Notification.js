const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  event: { type: String, required: true }, 

  
   targetModels: [
      {
        type: String,
        enum: ["Student", "Customer", "User", "Admin"], 
      },
    ],

  
   targetUsers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, required: true },
        userModel: {
          type: String,
          enum: ["Student", "Customer", "User", "Admin"], 
          required: true,
        },
      },
    ],

  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

  isReadBy: [
    {
      userId: mongoose.Schema.Types.ObjectId,
      readAt: Date,
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Notification", NotificationSchema);
