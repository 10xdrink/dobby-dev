const mongoose = require("mongoose");

const shopSortSettingSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ["default", "custom"],
    default: "default",
  },
  customSortOption: {
    type: String,
    enum: [
      "first_created",
      "latest_created",
      "A_to_Z",
      "Z_to_A",
      "most_ordered",
    ],
    default: "latest_created",
  },
}, { timestamps: true });

module.exports = mongoose.model("ShopSortSetting", shopSortSettingSchema);
