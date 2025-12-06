const AdminMailTemplate = require("../models/AdminMailTemplate");
const cloudinary = require("../config/cloudinary");


exports.getTemplate = async (req, res) => {
  try {
    const template = await AdminMailTemplate.findOne();
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: "Error fetching template", error });
  }
};


exports.updateTemplate = async (req, res) => {
  try {
    let data = req.body;

    
    if (typeof data.pageLinks === "string") {
      data.pageLinks = JSON.parse(data.pageLinks);
    }
    if (typeof data.socialMediaLinks === "string") {
      data.socialMediaLinks = JSON.parse(data.socialMediaLinks);
    }

    let template = await AdminMailTemplate.findOne();

    
    if (req.file) {
      if (template && template.logoPublicId) {
        await cloudinary.uploader.destroy(template.logoPublicId);
      }
      data.logoUrl = req.file.path;
      data.logoPublicId = req.file.filename;
    }

    if (template) {
      
      template.set(data);
    } else {
      template = new AdminMailTemplate(data);
    }

    await template.save();

    res.json({
      message: "Template updated successfully",
      template,
    });
  } catch (error) {
    console.error("updateTemplate error:", error);
    res.status(500).json({ message: "Error updating template", error });
  }
};
