const Cancellation = require("../models/cancellation");

// Create Cancellation
exports.createCancellation = async (req, res) => {
  try {
    const { description } = req.body;

    const cancellation = new Cancellation({ description });
    await cancellation.save();

    res.status(201).json({ success: true, data: cancellation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Get Cancellation
exports.getCancellation = async (req, res) => {
  try {
    const cancellation = await Cancellation.find().sort({ createdAt: -1 }).limit(1); // latest one
    if (!cancellation.length) {
      return res.status(404).json({ success: false, message: "No Cancellation found" });
    }
    res.json({ success: true, data: cancellation[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
