const express = require('express');
const { createContactUs, getContactUs, deleteContact, updateStatus, replyToContact } = require('../controllers/contactUsController');
const router = express.Router();

router.post("/",createContactUs);
router.get("/",getContactUs)
router.delete("/:id",deleteContact)
router.put("/:id",updateStatus)
router.post("/:id/reply", replyToContact);


module.exports = router