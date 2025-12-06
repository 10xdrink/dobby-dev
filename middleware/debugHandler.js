const EnvironmentSettings = require("../models/Environment")

const debugHandler = async (err, req, res, next) => {
  try {
    const settings = await EnvironmentSettings.findOne();
    const isDebug = settings?.appDebug;

    if (isDebug) {
      return res.status(500).json({
        message: err.message,
        stack: err.stack,
      });
    } else {
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
      });
    }
  } catch (dbErr) {
    return res.status(500).json({ message: "Critical error", error: dbErr.message });
  }
};

module.exports = { debugHandler}