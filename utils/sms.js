const twilio = require("twilio");
const axios = require("axios");
const SMS = require("../models/SMSConfig");


exports.sendSMS = async (to, otp) => {
  const config = await SMS.findOne();
  if (!config) throw new Error("No SMS config found");

  
  if (config.twoFactor?.isActive) {
    if (!config.twoFactor.apiKey) throw new Error("2Factor API Key missing");

    const url = `https://2factor.in/API/V1/${config.twoFactor.apiKey}/SMS/${to}/${otp}`;
    try {
      const resp = await axios.get(url);
      if (resp.data.Status !== "Success") {
        throw new Error("2Factor SMS failed: " + JSON.stringify(resp.data));
      }
      console.log(" OTP sent via 2Factor");
      return { provider: "2Factor", success: true };
    } catch (err) {
      console.error("2Factor sendSMS error:", err.message);
      throw new Error("Failed to send OTP via 2Factor");
    }
  }

  
  if (config.twilio?.isActive) {
    if (!config.twilio.sid || !config.twilio.token || (!config.twilio.from && !config.twilio.messagingServiceSid)) {
      throw new Error("Twilio credentials missing");
    }

    try {
      const client = twilio(config.twilio.sid, config.twilio.token);

      const body = config.twilio.otpTemplate
        ? config.twilio.otpTemplate.replace("{{OTP}}", otp)
        : `Your OTP is ${otp}`;

      await client.messages.create({
        body,
        from: config.twilio.messagingServiceSid || config.twilio.from,
        to,
      });

      console.log(" OTP sent via Twilio");
      return { provider: "Twilio", success: true };
    } catch (err) {
      console.error("Twilio sendSMS error:", err.message);
      throw new Error("Failed to send OTP via Twilio");
    }
  }

  
  throw new Error("No active SMS provider. Please enable Twilio or 2Factor");
};
