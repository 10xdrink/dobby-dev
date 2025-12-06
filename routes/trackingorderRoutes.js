const express = require("express");
const { getTrackingDetails } = require("../controllers/trackingController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/orders/:orderId/tracking", protect(["customer"]), getTrackingDetails);


module.exports = router;
