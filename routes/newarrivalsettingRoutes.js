const express = require("express")
const { updateNewArrivalSettings, getNewArrivalSettings } = require("../controllers/newarrivalsettingController")
const router  = express.Router()

router.put("/update", updateNewArrivalSettings)
router.get("/", getNewArrivalSettings)

module.exports = router