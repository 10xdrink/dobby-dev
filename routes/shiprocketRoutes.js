const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { integrateShiprocket, getShiprocketIntegration } = require("../controllers/shiprocketintegrationController");
const checkActiveShop = require("../middleware/checkActiveShop");


router.post(
  "/integrate",
  protect(["shopkeeper"]),
  checkActiveShop,
  integrateShiprocket
);

router.get(
  "/integration",
  protect(["shopkeeper"]),
  checkActiveShop,
  getShiprocketIntegration
);

module.exports = router;
