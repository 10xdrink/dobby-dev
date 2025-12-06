const mongoose = require("mongoose");

const newArrivalSettingSchema = new mongoose.Schema({
  durationType: {
    type: String,
    enum: ["7days", "15days", "30days", "1month", "3months", "6months"],
    default: "7days",
  },
  sortingMode: {
    type: String,
    enum: ["default", "custom"],
    default: "default",
  },
  customSortOption: {
    type: String,
    enum: [
      "latest_created",
      "first_created",
      "A_to_Z",
      "Z_to_A",
      "most_reviews",
      "best_rating",
    ],
    default: "latest_created",
  },
}, { timestamps: true });

module.exports = mongoose.model("NewArrivalSetting", newArrivalSettingSchema);
