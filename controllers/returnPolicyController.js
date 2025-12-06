const ReturnPolicy = require("../models/returnPolicyModel");



exports.createPolicy = async (req, res) => {
  try {
    const { description } = req.body;
    const policy = await ReturnPolicy.create({
      description,
    });
    res.status(201).json({
      success: true,
      message: "Policy created successfully",
      policy,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPolicy = async (req, res) => {
  try {
    const policies = await ReturnPolicy.find();
    res.json(policies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
