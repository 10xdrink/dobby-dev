const CompanyReliability = require("../models/CompanyReliability");
const cloudinary = require("cloudinary").v2;


exports.updateReliability = async (req, res) => {
  try {
    const { key, title, status } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, message: "Key is required" });
    }

    let section = await CompanyReliability.findOne({ key });
    if (!section) {
      section = new CompanyReliability({ key });
    }

    
    if (title) section.title = title;

    
    if (status !== undefined) section.status = status;

    
    if (req.file && req.file.path) {
     
      if (section.iconPublicId) {
        await cloudinary.uploader.destroy(section.iconPublicId);
      }

      
      section.icon = req.file.path; 
      section.iconPublicId = req.file.filename;
    }

    await section.save();

    res.json({
      success: true,
      message: `${key} updated successfully`,
      data: section,
    });
  } catch (err) {
    console.error("Update Reliability Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getAllReliability = async (req, res) => {
  try {
    const data = await CompanyReliability.find();
    res.json({ success: true, data });
  } catch (err) {
    console.error("Get All Reliability Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getActiveReliability = async (req, res) => {
  try {
    const data = await CompanyReliability.find({ status: true });
    res.json({ success: true, data });
  } catch (err) {
    console.error("Get Active Reliability Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
