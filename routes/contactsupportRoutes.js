const express = require("express")
const { sendSupportMessage } = require("../controllers/contactsupportController")
const router = express.Router()

router.post("/", sendSupportMessage)

module.exports = router