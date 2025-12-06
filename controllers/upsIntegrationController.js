const UpsService = require("../services/upsService");
const UpsApiService = require("../services/upsApiService");
const logger = require("../config/logger");

exports.integrateUps = async (req, res) => {
  const shopkeeperId = req.user.id;
  try {
    const integration = await UpsService.upsertIntegration(shopkeeperId, req.body);
   // await UpsApiService.createWebhook(shopkeeperId);
    res.status(200).json({ success: true, message: "UPS integrated successfully", data: integration });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.getUpsIntegration = async (req, res) => {
  const shopkeeperId = req.user.id;
  const integration = await UpsService.getIntegration(shopkeeperId);
  if (!integration) return res.status(404).json({ success: false, message: "No UPS integration found" });
  res.status(200).json({ success: true, data: integration });
};
