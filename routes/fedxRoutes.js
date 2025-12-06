const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { integrateFedex, getFedexIntegration } = require("../controllers/fedxIntegrationController");

router.post("/integrate", protect(["shopkeeper"]), checkActiveShop, integrateFedex);
router.get("/integration", protect(["shopkeeper"]), checkActiveShop, getFedexIntegration);

module.exports = router;
