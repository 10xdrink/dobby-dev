const express = require("express")
const { updateConfig, getConfig } = require("../controllers/smsconfigController")
const router = express.Router()

router.put("/", updateConfig)
router.get("/", getConfig)


module.exports = router