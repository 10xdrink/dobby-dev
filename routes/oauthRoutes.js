// routes/oauthRoutes.js
const express = require("express");
const { upsertProvider, getAllProviders, getActiveProviders } = require("../controllers/oauthController");
const router = express.Router();


// Admin APIs
router.post("/provider", upsertProvider);
router.get("/providers", getAllProviders); 

// Public API
router.get("/providers/active", getActiveProviders); 

module.exports = router;
