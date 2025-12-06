const express = require("express")
const {
  addCurrency,
  getCurrency,
  updateCurrency,
  deleteCurrency,
  toggleCurrency,
  getActiveCurrency
} = require("../controllers/currencyController")

const router = express.Router()

// add currency
router.post("/", addCurrency)

// get all currencies
router.get("/", getCurrency)

// get only active currencies
router.get("/active", getActiveCurrency)

// update currency
router.put("/:id", updateCurrency)

// delete currency
router.delete("/:id", deleteCurrency)

// toggle active/inactive
router.put("/toggle/:id", toggleCurrency)

module.exports = router
