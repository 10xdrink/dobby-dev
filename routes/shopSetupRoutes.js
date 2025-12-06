/*  const express = require('express');
const { createShopSetup, getAllShops, getShopById, updateShopById } = require('../controllers/shopSetupController');
const {protect} = require("../middleware/authMiddleware")
const router = express.Router();


router.post('/create', protect(['shopkeeper']), createShopSetup);
router.get("/",getAllShops)
router.get("/:id",getShopById)
router.put('/:id', protect(['shopkeeper']), updateShopById);

module.exports = router; */

