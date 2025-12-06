const express = require('express');
const router = express.Router();

const upload = require("../middleware/upload")
const { getTemplate, updateTemplate } = require('../controllers/adminmailtemplateController');


router.get('/', getTemplate);
 

router.put('/', upload.single('logo'), updateTemplate);

module.exports = router;
