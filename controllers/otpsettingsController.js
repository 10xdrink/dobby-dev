const OtpSettings = require("../models/OtpSettings")

exports.getOtpLoginSettings = async (req,res)=>{
  try {
    let settings = await OtpSettings.findOne();
    if (!settings) {
      settings = await OtpSettings.create({});
    }
    res.status(200).json(settings);
  } catch (err) {
    console.error("Get Login Settings Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateOtpLoginSettings = async (req,res)=>{
  try {
    const { maxOtpHit, otpResendTime, tempOtpBlockTime, maxLoginHit, tempLoginBlockTime } = req.body;

    let settings = await OtpSettings.findOne();
    if (!settings) {
      settings = new OtpSettings({});
    }

    if (maxOtpHit !== undefined) settings.maxOtpHit = maxOtpHit;
    if (otpResendTime !== undefined) settings.otpResendTime = otpResendTime;
    if (tempOtpBlockTime !== undefined) settings.tempOtpBlockTime = tempOtpBlockTime;
    if (maxLoginHit !== undefined) settings.maxLoginHit = maxLoginHit;
    if (tempLoginBlockTime !== undefined) settings.tempLoginBlockTime = tempLoginBlockTime;

    await settings.save();

    res.status(200).json({ message: "Settings updated successfully", settings });
  } catch (err) {
    console.error("Update Login Settings Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
