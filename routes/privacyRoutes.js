const express = require("express");
const { createPrivacy, getPrivacy } = require("../controllers/privacyController");

const router = express.Router();

router.post("/", createPrivacy);
router.get("/", getPrivacy);

module.exports = router;
