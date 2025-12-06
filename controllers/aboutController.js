const About = require("../models/About");

// Create About Us
exports.createAbout = async (req, res) => {
  try {
    const {  description } = req.body;

    const about = new About({  description });
    await about.save();

    res.status(201).json({ success: true, data: about });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get About Us
exports.getAbout = async (req, res) => {
  try {
    const about = await About.find().sort({ createdAt: -1 }).limit(1); // latest one
    if (!about.length) {
      return res.status(404).json({ success: false, message: "No About Us found" });
    }
    res.json({ success: true, data: about[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
