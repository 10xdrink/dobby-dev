const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      required: true,
      unique: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          "Shop Management",
          "Categories",
          "Sub Categories",
          "Student Management",
          "Customer Management",
          "Order Management",
          "Promotions & Marketing",
          "Analytics & Reports",
          "Review/Rating Management",
          "Customer Interaction",
        ],
      },
    ],
    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmployeeRole", roleSchema);
