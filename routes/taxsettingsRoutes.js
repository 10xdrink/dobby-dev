const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { getTaxSettings, saveTaxSettings, updateRegionalTaxRate, removeRegionalTaxRate } = require("../controllers/taxsettingsController");

// All routes require authentication and active shop
router.use(protect(["shopkeeper"]), checkActiveShop);

// Get tax settings
router.get("/", getTaxSettings);

// Save/Update tax settings
router.post("/", saveTaxSettings);




// Update regional tax rate
router.put("/regional/:regionId", updateRegionalTaxRate);

// Remove regional tax rate
router.delete("/regional/:regionId", removeRegionalTaxRate);

module.exports = router;