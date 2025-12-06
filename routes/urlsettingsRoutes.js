const express = require("express")
const { getUrl } = require("../controllers/urlsettingsController")

const router = express.Router()

router.get("/",getUrl)

module.exports = router