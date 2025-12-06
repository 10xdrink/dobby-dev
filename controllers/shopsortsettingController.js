const ShopSortSetting = require("../models/ShopSortSetting");


exports.getShopSortSetting = async (req, res) => {
  try {
    const setting = await ShopSortSetting.findOne() || {
      mode: "default",
      customSortOption: "latest_created"
    };
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.updateShopSortSetting = async (req, res) => {
  try {
    const { mode, customSortOption } = req.body;

    let setting = await ShopSortSetting.findOne();
    if (!setting) {
      setting = await ShopSortSetting.create({ mode, customSortOption });
    } else {
      setting.mode = mode;
      setting.customSortOption = customSortOption;
      await setting.save();
    }

    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
