const SMS = require("../models/SMSConfig")

exports.getConfig = async(req,res) => {

    try {
        let config = await SMS.findOne()
        if(!config){
            config = await SMS.create({})
        }

        res.json({success:true, config})

    } catch (error) {

        res.status(500).json({success:false,message:error.message})

    }

}

exports.updateConfig = async (req, res) => {
  try {
    let config = await SMS.findOne();
    if (!config) {
      config = await SMS.create({});
    }

    const { twoFactor, twilio } = req.body;

    if (twoFactor) {
      config.twoFactor.apiKey = twoFactor.apiKey || config.twoFactor.apiKey;
      config.twoFactor.isActive = twoFactor.isActive ?? config.twoFactor.isActive;

      
      if (twoFactor.isActive) {
        config.twilio.isActive = false;
      }
    }

    if (twilio) {
      config.twilio.sid = twilio.sid || config.twilio.sid;
      config.twilio.token = twilio.token || config.twilio.token;
      config.twilio.from = twilio.from || config.twilio.from;
      config.twilio.messagingServiceSid = twilio.messagingServiceSid || config.twilio.messagingServiceSid;
      config.twilio.otpTemplate = twilio.otpTemplate || config.twilio.otpTemplate;
      config.twilio.isActive = twilio.isActive ?? config.twilio.isActive;

     
      if (twilio.isActive) {
        config.twoFactor.isActive = false;
      }
    }

    await config.save();

    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
