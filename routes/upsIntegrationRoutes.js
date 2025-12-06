const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { integrateUps, getUpsIntegration } = require("../controllers/upsIntegrationController");

router.post("/integrate", protect(["shopkeeper"]), checkActiveShop, integrateUps);
router.get("/integration", protect(["shopkeeper"]), checkActiveShop, getUpsIntegration);

module.exports = router;
