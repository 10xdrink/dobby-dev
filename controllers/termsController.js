const Terms = require("../models/terms.model");

exports.createTerms = async (req, res) => {
  try {
    const {  description } = req.body;
    const terms = new Terms({  description });
    await terms.save();
    res.status(201).json({ success: true, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTerms = async (req, res) => {
  try {
    const terms = await Terms.find()
    res.json({ success: true, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
