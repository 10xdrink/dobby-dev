const express = require("express")
const { getTopRatedSetting, updateTopRatedSetting } = require("../controllers/topratedsettingController")
const router = express.Router()

router.get("/", getTopRatedSetting)
router.put("/update", updateTopRatedSetting)

module.exports =  router