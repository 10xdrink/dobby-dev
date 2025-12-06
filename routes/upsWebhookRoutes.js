const express = require("express");
const bodyParser = require("body-parser");
const { upsWebhook } = require("../controllers/upsWebhookController");
const router = express.Router();

router.post("/webhook", bodyParser.raw({ type: "application/json" }), upsWebhook);

module.exports = router;
