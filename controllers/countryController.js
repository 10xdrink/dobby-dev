const axios = require("axios");
const Country = require("../models/Country");

exports.importCountry = async (req, res) => {
  try {
    const { iso2 } = req.body;
    if (!iso2) {
      return res.status(400).json({ success: false, message: "ISO2 code required" });
    }

    // Check if already exists
    const existing = await Country.findOne({ iso2 });
    if (existing) {
      return res.status(400).json({ success: false, message: "Country already imported" });
    }

    // Fetch country
    const response = await axios.get(
      `https://restcountries.com/v3.1/alpha/${iso2}?fields=name,cca2,currencies,flags,languages`
    );

    const c = Array.isArray(response.data) ? response.data[0] : response.data;

    if (!c) {
      return res.status(404).json({ success: false, message: "Country not found in API" });
    }

    const newCountry = new Country({
      name: c.name?.common || "",
      iso2: c.cca2 || "",
      currency: c.currencies ? Object.keys(c.currencies)[0] : "",
      flag: c.flags?.svg || c.flags?.png || "",
      languages: c.languages
        ? Object.keys(c.languages).map((code) => ({
            code,
            name: c.languages[code],
          }))
        : [],
    });

    const saved = await newCountry.save();

    res.json({
      success: true,
      data: {
        name: saved.name,
        iso2: saved.iso2,
        currency: saved.currency,
        flag: saved.flag,
        languages: saved.languages,
      },
    });
  } catch (err) {
    console.error("Import error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCountries = async (req, res) => {
  try {
    const countries = await Country.find({}, "name iso2 flag currency").sort({
      name: 1,
    });
    res.json({ success: true, data: countries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLanguagesByCountry = async (req, res) => {
  try {
    const { iso2 } = req.params;
    const country = await Country.findOne({ iso2 });

    if (!country) {
      return res
        .status(404)
        .json({ success: false, message: "Country not found" });
    }

    res.json({ success: true, data: country.languages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addCountry = async (req, res) => {
  try {
    const { name, iso2, currency, flag, languages } = req.body;

    if (!name || !iso2) {
      return res
        .status(400)
        .json({ success: false, message: "Name and ISO2 required" });
    }

    const existing = await Country.findOne({ iso2 });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Country already exists" });
    }

    const newCountry = new Country({
      name,
      iso2,
      currency: currency || "",
      flag: flag || "",
      languages: languages || [],
    });

    const saved = await newCountry.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCountry = async (req, res) => {
  try {
    const { iso2 } = req.params;
    const updated = await Country.findOneAndUpdate({ iso2 }, req.body, {
      new: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Country not found" });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCountry = async (req, res) => {
  try {
    const { iso2 } = req.params;
    const deleted = await Country.findOneAndDelete({ iso2 });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Country not found" });
    }

    res.json({ success: true, message: "Country deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addLanguageToCountry = async (req, res) => {
  try {
    const { iso2 } = req.params;
    const { code, name } = req.body;

    const country = await Country.findOne({ iso2 });
    if (!country) {
      return res
        .status(404)
        .json({ success: false, message: "Country not found" });
    }

    if (country.languages.some((l) => l.code === code)) {
      return res.status(400).json({
        success: false,
        message: "Language already exists for this country",
      });
    }

    country.languages.push({ code, name });
    await country.save();

    res.json({ success: true, data: country });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllCountriesFromAPI = async (req, res) => {
  try {

    const response = await axios.get(
  "https://restcountries.com/v3.1/name/india?fullText=true&fields=name,cca2,flags,currencies"
);


    // const response = await axios.get(
    //   "https://restcountries.com/v3.1/all?fields=name,cca2,flags,currencies"
    // );

    const apiCountries = response.data.map((c) => ({
      name: c.name?.common || "",
      iso2: c.cca2 || "",
      flag: c.flags?.svg || c.flags?.png || "",
      currency: c.currencies ? Object.keys(c.currencies)[0] : "",
    }));

    res.json({ success: true, data: apiCountries });
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
