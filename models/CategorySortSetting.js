const mongoose = require("mongoose");

const categorySortSettingSchema = new mongoose.Schema(
  {
    useDefault: { type: Boolean, default: true },
    sortOption: {
      type: String,
      enum: ["latestCreated", "firstCreated", "AtoZ", "ZtoA", null],
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CategorySortSetting", categorySortSettingSchema);
