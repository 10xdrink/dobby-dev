const express = require("express")
const { updateShopSortSetting, getShopSortSetting } = require("../controllers/shopsortsettingController")
const router = express.Router()

router.get("/", getShopSortSetting)
router.put("/update", updateShopSortSetting)

module.exports = router