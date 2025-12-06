const EnvironmentSettings = require("../models/Environment")

module.exports = async (req, res, next) => {
  try {
    const settings = await EnvironmentSettings.findOne();
    if (settings?.appDebug) {
      console.log(`[DEBUG] ${req.method} ${req.originalUrl}`);
    }
  } catch (err) {
    console.error("Debug middleware error:", err.message);
  }
  next();
};
