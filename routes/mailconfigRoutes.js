const express = require("express")
const { saveMailConfig, getMailConfig } = require("../controllers/mailconfigController")
const router = express.Router()

router.put("/", saveMailConfig)
router.get("/", getMailConfig)

module.exports = router