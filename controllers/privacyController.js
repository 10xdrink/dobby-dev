const Privacy = require("../models/privacy")

exports.createPrivacy = async (req, res) => {
  try {
    const { description } = req.body;
    const privacy = new Privacy({description });
    await privacy.save();
    res.status(201).json({
      success:true,
      message: "Privacy Policy created successfully",
      privacy,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPrivacy = async (req, res) => {
  try {
    const privacy = await Privacy.find();
    res.json({success:true,
      message: "Privacy Policy fetched successfully",
      privacy,
     });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
