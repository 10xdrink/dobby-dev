const FedexService = require("../services/fedxService");
const FedexApiService = require("../services/fedxapiService");
const logger = require("../config/logger");

exports.integrateFedex = async (req, res) => {
  const shopkeeperId = req.user.id;
  logger.info("[FedExController] Integration request received", {
    shopkeeperId,
    source: "integrateFedex",
  });

  try {
    const {
      clientId,
      clientSecret,
      accountNumber,
      meterNumber,
      pickupLocation,
      pickupContactName,
      pickupPhone,
      pickupAddress,
      pickupPincode,
      pickupCity,
      pickupState,
      pickupCountry,
      useSandbox,
    } = req.body;

    
    if (
      !clientId ||
      !clientSecret ||
      !accountNumber ||
      !pickupLocation ||
      !pickupContactName ||
      !pickupPhone ||
      !pickupAddress ||
      !pickupPincode ||
      !pickupCity ||
      !pickupState
    ) {
      logger.warn("[FedExController] Missing required integration fields", {
        shopkeeperId,
        receivedFields: Object.keys(req.body),
      });
      return res
        .status(400)
        .json({ success: false, message: "All required fields must be filled" });
    }

    
    logger.info("[FedExController] Upserting FedEx integration", {
      shopkeeperId,
      environment: useSandbox ? "sandbox" : "production",
    });

    const integration = await FedexService.upsertIntegration(shopkeeperId, {
      clientId,
      clientSecret,
      accountNumber,
      meterNumber,
      pickupLocation,
      pickupContactName,
      pickupPhone,
      pickupAddress,
      pickupPincode,
      pickupCity,
      pickupState,
      pickupCountry,
      useSandbox: (typeof useSandbox === "boolean")
  ? useSandbox
  : String(useSandbox).toLowerCase() === "true",
      isActive: true,
    });

    logger.info("[FedExController] Integration upsert successful", {
      shopkeeperId,
      integrationId: integration._id,
    });

    
    try {
      await FedexApiService.createWebhook(shopkeeperId);
      logger.info("[FedExController] FedEx webhook created successfully", {
        shopkeeperId,
      });
    } catch (err) {
      logger.error("[FedExController] FedEx webhook creation failed", {
        shopkeeperId,
        error: err.message,
        response: err.response?.data,
      });
    }

   
    logger.info("[FedExController] FedEx integration completed successfully", {
      shopkeeperId,
      integrationId: integration._id,
    });

    res.status(200).json({
      success: true,
      message: "FedEx integration saved successfully",
      data: integration,
    });
  } catch (err) {
    logger.error("[FedExController] FedEx integration failed", {
      shopkeeperId,
      error: err.message,
      stack: err.stack,
    });

    const status = err.status || 500;
    res.status(status).json({
      success: false,
      message:
        status === 403
          ? "Active shop required for FedEx integration"
          : "Internal server error",
      error: status === 500 ? err.message : undefined,
    });
  }
};

exports.getFedexIntegration = async (req, res) => {
  const shopkeeperId = req.user.id;
  logger.info("[FedExController] Get integration request received", {
    shopkeeperId,
    source: "getFedexIntegration",
  });

  try {
    
    const integration = await FedexService.getIntegration(shopkeeperId);

    if (!integration) {
      logger.warn("[FedExController] No FedEx integration found", {
        shopkeeperId,
      });
      return res
        .status(404)
        .json({ success: false, message: "No FedEx integration found" });
    }

    
    logger.info("[FedExController] FedEx integration fetched successfully", {
      shopkeeperId,
      integrationId: integration._id,
    });

    res.status(200).json({ success: true, data: integration });
  } catch (err) {
    logger.error("[FedExController] Failed to fetch FedEx integration", {
      shopkeeperId,
      error: err.message,
      stack: err.stack,
    });

    const status = err.status || 500;
    res.status(status).json({
      success: false,
      message:
        status === 403
          ? "Active shop required to view FedEx integration"
          : "Internal server error",
      error: status === 500 ? err.message : undefined,
    });
  }
};
