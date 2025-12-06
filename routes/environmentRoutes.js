const express = require("express")
const { getSettings, updateSettings } = require("../controllers/environmentController")

const router = express.Router()

router.get("/",getSettings)
router.put("/",updateSettings)

module.exports = router