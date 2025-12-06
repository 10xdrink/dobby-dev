const express = require("express");
const { shiprocketWebhook } = require("../controllers/shiprocketWebhookController");
const router = express.Router();


router.post("/webhook", express.json(), shiprocketWebhook);

module.exports = router;
