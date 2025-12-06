const express = require("express");
const { createTerms, getTerms } = require("../controllers/termsController");

const router = express.Router();

router.post("/", createTerms);
router.get("/", getTerms);

module.exports = router;
