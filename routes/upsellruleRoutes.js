const express = require("express");
const { 
  createRule, 
  getRules, 
  updateRule, 
  deleteRule, 
  toggleRuleStatus,
  getRuleById,
  getRuleStats,
  getPublicRules, 
  getPublicRuleById 
} = require("../controllers/upsellruleController");
const checkActiveShop = require("../middleware/checkActiveShop");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();


router.post("/create", protect(["shopkeeper"]), checkActiveShop, createRule);
router.get("/", protect(["shopkeeper"]), checkActiveShop, getRules);
router.get("/single/:id", protect(["shopkeeper"]), checkActiveShop, getRuleById);
router.get("/stats/:id", protect(["shopkeeper"]), checkActiveShop, getRuleStats);
router.put("/update/:id", protect(["shopkeeper"]), checkActiveShop, updateRule);
router.patch("/toggle/:id", protect(["shopkeeper"]), checkActiveShop, toggleRuleStatus);
router.delete("/delete/:id", protect(["shopkeeper"]), checkActiveShop, deleteRule);

// PUBLIC ROUTES (for customers)
router.get("/:shopId/rules", getPublicRules);
router.get("/public/single/:ruleId", getPublicRuleById);

module.exports = router;