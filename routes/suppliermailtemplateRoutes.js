const express = require('express');
const router = express.Router();
const upload = require("../middleware/upload");
const { getTemplate, updateTemplate } = require('../controllers/suppliermailtemplateController');



router.get("/:type", getTemplate);


router.put("/:type", upload.fields([{ name: "logo" }, { name: "icon" }]), updateTemplate);


module.exports = router;
