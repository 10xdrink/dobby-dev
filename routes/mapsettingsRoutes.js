const express = require('express');
const { getMapSettingsPublic, getMapSettingsAdmin, updateMapSettings, geocodeAddress } = require('../controllers/mapsettingsController');
const router = express.Router();


// Public
router.get('/maps',getMapSettingsPublic);

// Admin
router.get('/admin/maps', getMapSettingsAdmin);
router.put('/admin/maps', updateMapSettings);

// Example usage: geocode (server key)
router.get('/geocode', geocodeAddress);

module.exports = router;
