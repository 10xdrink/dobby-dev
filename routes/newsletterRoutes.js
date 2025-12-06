const express = require("express");
const {
  subscribeUser,
  handleWebhook,
  getSubscribers,
  sendPersonalizedEmail,
} = require("../controllers/newsletterController");

const router = express.Router();

router.post("/subscribe", subscribeUser);

router.post("/webhook", handleWebhook);

router.get("/webhook", (req, res) => {
  res.status(200).send("Webhook verified");
});

router.get("/subscribers", getSubscribers);

router.post("/send-email/:subscriberId", sendPersonalizedEmail);

module.exports = router;
