const Shipping = require("../models/shipping");

// Create Shipping
exports.createShipping = async (req, res) => {
  try {
    const { description } = req.body;

    const shipping = new Shipping({ description });
    await shipping.save();

    res.status(201).json({ success: true, data: shipping });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Get Shipping
exports.getShipping = async (req, res) => {
  try {
    const shipping = await Shipping.find().sort({ createdAt: -1 }).limit(1); // latest one
    if (!shipping.length) {
      return res.status(404).json({ success: false, message: "No Shipping found" });
    }
    res.json({ success: true, data: shipping[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
