const express = require("express");
const { getGateways, getActiveGateways, updateGateway, getPaymentSettings, updatePaymentSettings } = require("../controllers/paymentgatewayController");

const upload = require('../middleware/upload');

const router = express.Router()

router.get("/", getGateways);


router.get("/active", getActiveGateways);

// Get payment settings (digital payment and COD toggles)
router.get("/settings", getPaymentSettings);

// Update payment settings (digital payment and COD toggles)
router.put("/settings", updatePaymentSettings);


router.put(
  "/update",
  upload.single("logo"), updateGateway
);


module.exports = router