const express = require("express")
const { recordReferralClick } = require("../controllers/referralclickController")
const router = express.Router()

router.get("/", recordReferralClick)

module.exports = router