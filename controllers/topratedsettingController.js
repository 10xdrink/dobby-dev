const TopRatedSetting = require("../models/TopRatedSettings");


exports.getTopRatedSetting = async (req, res) => {
  try {
    const setting = await TopRatedSetting.findOne() || 
      await TopRatedSetting.create({}); 
    res.json({ success: true, setting });
  } catch (err) {
    console.error("getTopRatedSetting error:", err);
    res.status(500).json({ message: err.message });
  }
};


exports.updateTopRatedSetting = async (req, res) => {
  try {
    const { sortingMode, filterOption, customSortOption } = req.body;
    let setting = await TopRatedSetting.findOne();

    if (!setting) {
      setting = new TopRatedSetting({ sortingMode, filterOption, customSortOption });
    } else {
      if (sortingMode) setting.sortingMode = sortingMode;
      if (filterOption) setting.filterOption = filterOption;
      if (customSortOption) setting.customSortOption = customSortOption;
    }

    await setting.save();
    res.json({ success: true, message: "Top Rated Setting updated", setting });
  } catch (err) {
    console.error("updateTopRatedSetting error:", err);
    res.status(500).json({ message: err.message });
  }
};
