const Map = require("../models/mapSettings");

const axios = require("axios");

exports.getMapSettingsPublic = async (req, res) => {
  try {
    let settings = await Map.findOne().lean();
    if (!settings) {
      return res.json({ mapsEnabled: false, googleMapClientKey: "" });
    }
    res.json({
      mapsEnabled: settings.mapsEnabled,
      googleMapClientKey: settings.googleMapClientKey,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMapSettingsAdmin = async (req, res) => {
  try {
    let settings = await Map.findOne().lean();
    if (!settings) {
      return res.json({
        mapsEnabled: false,
        googleMapClientKey: "",
        googleMapServerKey: "",
      });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: update or create
exports.updateMapSettings = async (req, res) => {
  try {
    const { mapsEnabled, googleMapClientKey, googleMapServerKey } = req.body;

    const update = {
      mapsEnabled,
      googleMapClientKey,
      googleMapServerKey,
      updatedAt: new Date(),
    };

    const settings = await Map.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
    });

    res.json({ message: "Settings updated", settings });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


exports.geocodeAddress = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ message: "address required" });

    const settings = await Map.findOne().lean();
    if (!settings || !settings.googleMapServerKey)
      return res.status(400).json({ message: "Server key missing" });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${settings.googleMapServerKey}`;

    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch geocode" });
  }
};
