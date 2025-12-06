// routes/returnPolicyRoutes.js
const express = require("express");
const {
  getPolicy,
  
  createPolicy
} = require("../controllers/returnPolicyController");

const router = express.Router();

router.get("/", getPolicy);
router.post("/", createPolicy);


module.exports = router;
