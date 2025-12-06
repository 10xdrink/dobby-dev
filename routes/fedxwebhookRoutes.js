const express = require("express");
const bodyParser = require("body-parser");
const { fedexWebhook } = require("../controllers/fedxWebhookController");
const router = express.Router();

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  fedexWebhook
);
module.exports = router;
