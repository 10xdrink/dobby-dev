const EnvironmentSettings = require("../models/Environment")



// GET all settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await EnvironmentSettings.findOne();
    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// UPDATE settings 
exports.updateSettings = async (req, res) => {
  try {
    const { appName, appDebug, appMode } = req.body;

    const updateData = { appName, appDebug, appMode };

    const settings = await EnvironmentSettings.findOneAndUpdate({}, updateData, {
      new: true,
      upsert: true, 
    });

    

    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
