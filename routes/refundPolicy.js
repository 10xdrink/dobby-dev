const express = require("express");
const {
  createRefundPolicy,
  getRefundPolicy,
} = require("../controllers/refundPolicyController");

const router = express.Router(); 

router.post("/", createRefundPolicy);
router.get("/", getRefundPolicy);

module.exports = router;
