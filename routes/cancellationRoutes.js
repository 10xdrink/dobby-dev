const express = require('express');
const { createCancellation, getCancellation } = require('../controllers/cancellationController');
const router = express.Router();


// Create Cancellation
router.post('/', createCancellation);

// Get Cancellation
router.get('/', getCancellation);

module.exports = router;
