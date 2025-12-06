const express = require("express");
const { getCategorySortSetting, updateCategorySortSetting } = require("../controllers/categorysortController");
const router = express.Router()

router.get("/", getCategorySortSetting);
router.post("/update", updateCategorySortSetting);

module.exports = router