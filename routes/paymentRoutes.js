const express = require("express");
const router = express.Router();
const {
  initiatePayment,
  confirmPayment,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

router.post("/initiate", protect(["shopkeeper"]), initiatePayment);

router.post("/confirm", protect(["shopkeeper"]), confirmPayment);



module.exports = router;
