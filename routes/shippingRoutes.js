const express = require('express');
const { createShipping, getShipping } = require('../controllers/shippingController');
const router = express.Router();


// Create Shipping
router.post('/', createShipping);

// Get Shipping
router.get('/', getShipping);

module.exports = router;
