const CategorySortSetting = require("../models/CategorySortSetting");


exports.updateCategorySortSetting = async (req, res) => {
  try {
    const { useDefault, sortOption } = req.body;

    let setting = await CategorySortSetting.findOne();
    if (!setting) {
      setting = new CategorySortSetting();
    }

    setting.useDefault = useDefault;
    setting.sortOption = useDefault ? null : sortOption;
    await setting.save();

    res.status(200).json({ message: "Sorting preference updated", setting });
  } catch (error) {
    console.error("Update Sort Setting Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getCategorySortSetting = async (req, res) => {
  try {
    const setting = await CategorySortSetting.findOne();
    res.status(200).json(setting || {});
  } catch (error) {
    console.error("Get Sort Setting Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
