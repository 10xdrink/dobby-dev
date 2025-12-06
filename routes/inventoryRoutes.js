// routes/inventoryRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { getInventoryStatus, getInventoryStats, getInventoryTurnover, getStockMovement, getCompleteInventoryReport } = require("../controllers/inventoryController");



const shopkeeperAuth = [protect(["shopkeeper"]), checkActiveShop];


router.get("/status", shopkeeperAuth, getInventoryStatus);


router.get("/stats", shopkeeperAuth, getInventoryStats);


router.get("/turnover", shopkeeperAuth, getInventoryTurnover);


router.get("/stock-movement", shopkeeperAuth, getStockMovement);


router.get("/report", shopkeeperAuth, getCompleteInventoryReport);


module.exports = router;