const mongoose = require("mongoose");

const topRatedSettingSchema = new mongoose.Schema({
  sortingMode: {
    type: String,
    enum: ["default", "custom"],
    default: "default", 
  },
  filterOption: {
    type: String,
    enum: ["none", "4plus", "3plus"],
    default: "none",
  },
  customSortOption: {
    type: String,
    enum: ["most_reviews", "average_rating", "most_orders", "none"],
    default: "none",
  },
}, { timestamps: true });

module.exports = mongoose.model("TopRatedSetting", topRatedSettingSchema);
