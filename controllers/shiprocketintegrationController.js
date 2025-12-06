const ShiprocketService = require("../services/shiprocketService");
const ShiprocketApiService = require("../services/shiprocketApiService");

exports.integrateShiprocket = async (req, res) => {
  try {
    const shopkeeperId = req.user.id;
    const {
      shiprocketEmail,
      shiprocketPassword,
      pickupLocation,
      pickupContactName,
      pickupPhone,
      pickupAddress,
      pickupPincode,
      pickupCity,
      pickupState,
      pickupCountry,
    } = req.body;

    if (
      !shiprocketEmail ||
      !shiprocketPassword ||
      !pickupLocation ||
      !pickupContactName ||
      !pickupPhone ||
      !pickupAddress ||
      !pickupPincode ||
      !pickupCity ||
      !pickupState
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All required fields must be filled" });
    }

    const integration = await ShiprocketService.upsertIntegration(shopkeeperId, {
      shiprocketEmail,
      shiprocketPassword,
      pickupLocation,
      pickupContactName,
      pickupPhone,
      pickupAddress,
      pickupPincode,
      pickupCity,
      pickupState,
      pickupCountry,
      isActive: true,
    });

    console.log(" Decrypted Password:", integration.getDecryptedPassword());

    try {
  await ShiprocketApiService.createWebhook(shopkeeperId);
  console.log(" Webhook created successfully");
} catch (err) {
  console.error(" Webhook creation failed:", err.response?.data || err.message);
}

    // Remove sensitive props if any (service already returns hashed password hidden by .select)
    res.status(200).json({
      success: true,
      message: "Shiprocket integration saved successfully",
      data: integration,
    });
  } catch (error) {
    console.error("Shiprocket Integration Error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message:
        status === 403
          ? "Active shop required to integrate Shiprocket account"
          : "Internal server error",
      error: status === 500 ? error.message : undefined,
    });
  }
};

exports.getShiprocketIntegration = async (req, res) => {
  try {
    const shopkeeperId = req.user.id;
    const integration = await ShiprocketService.getIntegration(shopkeeperId);

    if (!integration) {
      return res
        .status(404)
        .json({ success: false, message: "No integration found" });
    }

    res.status(200).json({
      success: true,
      data: integration,
    });
  } catch (error) {
    console.error("Get Integration Error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message:
        status === 403
          ? "Active shop required to view Shiprocket integration"
          : "Internal server error",
      error: status === 500 ? error.message : undefined,
    });
  }
};
