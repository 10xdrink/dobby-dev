const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { getShippingRule, upsertShippingRule, toggleShippingRule } = require("../controllers/shippingruleController");

// All routes require shopkeeper authentication and active shop
router.use(protect(["shopkeeper"]), checkActiveShop);

// GET /api/shipping-rule - Get current shipping rule
router.get("/", getShippingRule);

// POST /api/shipping-rule - Create/Update shipping rule
router.post("/", upsertShippingRule);

// PATCH /api/shipping-rule/toggle - Toggle active status
router.patch("/toggle", toggleShippingRule);

module.exports = router;