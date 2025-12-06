const MailConfig = require("../models/MailConfig");

// Save or Update Mail Config
exports.saveMailConfig = async (req, res) => {
  try {
    const data = req.body;
    let config = await MailConfig.findOne();

    if (config) {
      config.set(data);
      await config.save();
    } else {
      config = await MailConfig.create(data);
    }

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Mail Config
exports.getMailConfig = async (req, res) => {
  try {
    const config = await MailConfig.findOne();
    if (!config) return res.status(404).json({ success: false, message: "No config found" });

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
