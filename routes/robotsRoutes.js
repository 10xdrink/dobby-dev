const express = require("express");
const robotsController = require("../controllers/robotsController");

const router = express.Router();

router.get("/robots.txt", robotsController.getRobotsTxt.bind(robotsController));

module.exports = router;

