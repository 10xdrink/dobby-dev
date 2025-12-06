const express = require("express");
const { getSeoSettings, updateSeoSettings } = require("../controllers/seosettingsController");
const router = express.Router()


router.get("/:page", getSeoSettings);


router.put("/:page", updateSeoSettings);


module.exports = router