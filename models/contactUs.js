const mongoose = require("mongoose");

const contactUsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please enter a valid email address"],
    },

    adminReply: {
      type: String,
      default: null,
    },
    interest: {
      type: String,
      required: [true, "Interest is required"],
    },
    status: {
      type: String,
      enum: ["Unread", "Responded", "Spam"],
      default: "Unread",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactUs", contactUsSchema);
