const express = require("express");
const { 
  getAllCountriesFromAPI, 
  importCountry, 
  getCountries, 
  getLanguagesByCountry, 
  addCountry, 
  updateCountry, 
  deleteCountry, 
  addLanguageToCountry 
} = require("../controllers/countryController");

const router = express.Router();

// Admin
router.get("/all", getAllCountriesFromAPI);    // show all (from API)
router.post("/import", importCountry);         // import single into DB




// Homepage
router.get("/", getCountries);                 // show imported (from DB)

// Extras
router.get("/:iso2/languages", getLanguagesByCountry);
router.post("/add", addCountry);
router.put("/:iso2", updateCountry);
router.delete("/:iso2", deleteCountry);
router.post("/:iso2/languages", addLanguageToCountry);

module.exports = router;
