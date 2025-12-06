const SocialMediaChat = require("../models/SocialMediaChat");
const logger = require("../config/logger"); 

exports.getWhatsAppNumber = async (req, res) => {
  try {
    const setting = await SocialMediaChat.findOne({ isActive: true }).sort({ updatedAt: -1 });

    if (!setting) {
      logger.warn("No active WhatsApp number found");
      return res.json({ number: null });
    }

    logger.info(`Fetched active WhatsApp number: ${setting.number}`);
    res.json({ number: setting.number, isActive: setting.isActive });
  } catch (err) {
    logger.error(`getWhatsAppNumber error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};



exports.updateWhatsAppNumber = async (req, res) => {
  try {
    let { number, isActive } = req.body;

    
    if (typeof isActive === "string") {
      isActive = isActive.toLowerCase() === "true";
    }

    
    if (isActive) {
      await SocialMediaChat.updateMany({ isActive: true }, { isActive: false });
    }

    let setting = await SocialMediaChat.findOne();
    if (setting) {
      setting.number = number ?? setting.number;
      setting.isActive = isActive ?? setting.isActive;
      logger.info(`Updating WhatsApp number: ${setting.number}`);
    } else {
      setting = new SocialMediaChat({ number, isActive });
      logger.info(`Creating new WhatsApp number: ${number}`);
    }

    await setting.save();
    res.json({ success: true, setting });
  } catch (err) {
    logger.error(`updateWhatsAppNumber error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};