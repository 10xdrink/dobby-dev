const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload")
const { createQuery, getQueries, deleteQuery, updateQuery } = require("../controllers/studentqueryController");

// Create new query
router.post("/", upload.single("image"), createQuery);

// Get all queries with optional filters
router.get("/", getQueries);

// Update query status
router.put("/:id/status", updateQuery);

// Delete query
router.delete("/:id", deleteQuery);

module.exports = router;