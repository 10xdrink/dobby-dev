const NewArrivalSetting = require("../models/NewArrivalSetting");


exports.updateNewArrivalSettings = async (req, res) => {
  try {
    const { durationType, sortingMode, customSortOption } = req.body;

    const existing = await NewArrivalSetting.findOne();
    if (existing) {
      existing.durationType = durationType;
      existing.sortingMode = sortingMode;
      existing.customSortOption = customSortOption;
      await existing.save();
    } else {
      await NewArrivalSetting.create({ durationType, sortingMode, customSortOption });
    }

    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getNewArrivalSettings = async (req, res) => {
  try {
    const settings = await NewArrivalSetting.findOne();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
