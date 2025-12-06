const express = require("express");
const router = express.Router();
const { createAbout, getAbout } = require("../controllers/aboutController");

router.post("/", createAbout); 
router.get("/", getAbout);      

module.exports = router;

