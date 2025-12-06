const express = require("express");
const { getTemplate, updateTemplate } = require("../controllers/customermailtemplateController");

const upload = require("../middleware/upload")

const router = express.Router()

router.get("/:type", getTemplate);


router.put("/:type", upload.fields([{ name: "logo" }, { name: "icon" }]), updateTemplate);


module.exports = router 