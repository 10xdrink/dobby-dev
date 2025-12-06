const Copyright = require("../models/copyright");


exports.getCopyright = async (req, res) => {
  try {
    const data = await Copyright.findOne();
    return res.json({
      success: true,
      text: data ? data.text : "",
    });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
};

exports.saveCopyright = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text)
      return res.status(400).json({ success: false, message: "Text required" });

    
    const updated = await Copyright.findOneAndUpdate(
      {},
      { text },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
};
