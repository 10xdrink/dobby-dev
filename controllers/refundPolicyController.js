const refundPolicy = require("../models/refundPolicy");

exports.createRefundPolicy = async (req, res) => {
  try {
    const { description } = req.body;   
    const newRefundPolicy = refundPolicy.create({ description });
    res.status(201).json({
        success: true,
        message: "Refund Policy created successfully",
        newRefundPolicy,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRefundPolicy = async (req, res) => {
  try {
    const policies = await refundPolicy.find();
    res.status(200).json({
        success: true,
        message: "Refund Policy fetched successfully",
        policies,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};