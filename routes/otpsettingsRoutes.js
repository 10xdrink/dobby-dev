const express = require("express")
const { getOtpLoginSettings, updateOtpLoginSettings } = require("../controllers/otpsettingsController")

const router = express.Router()

router.get("/",getOtpLoginSettings)
router.put("/",updateOtpLoginSettings)

module.exports = router