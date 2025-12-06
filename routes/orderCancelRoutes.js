const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { cancelOrder } = require("../controllers/orderCancelController");
const router = express.Router();


router.post("/cancel", protect(["customer"]), cancelOrder);

module.exports = router;
