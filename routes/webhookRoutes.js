const express = require("express");
const {
  stripeWebhook,
  razorpayWebhook,
  paypalWebhook,
} = require("../controllers/webhookController");
const router = express.Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);
router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body.toString("utf8");
    next();
  },
  razorpayWebhook
);
router.post("/paypal", express.json(), paypalWebhook);

// router.post('/paypal', express.raw({ type: 'application/json' }), paypalWebhook);

module.exports = router;
