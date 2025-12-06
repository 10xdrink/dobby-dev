/*  const Setting = require("../models/Settings");


exports.saveSettings = async (req, res) => {
  try {
    const encrypted = Setting.encryptFields(req.body);

    let setting = await Setting.findOne();
    if (setting) {
      
      Object.keys(encrypted).forEach((key) => {
        if (encrypted[key] !== undefined) {
          setting[key] = encrypted[key];
        }
      });
      await setting.save();
    } else {
      setting = await Setting.create(encrypted);
    }

    res.json({ success: true, message: "Settings saved successfully" });
  } catch (err) {
    console.error("Save Settings Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
      await setting.save();
    }

    res.json({ success: true, data: setting.getDecrypted() });
  } catch (err) {
    console.error("Get Settings Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}; */
