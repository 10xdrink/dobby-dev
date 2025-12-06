const express = require("express");
const router = express.Router();
const {
  getCopyright,
  saveCopyright,
} = require("../controllers/copyrightController");


router.get("/", getCopyright);


router.post("/save", saveCopyright);

module.exports = router;
