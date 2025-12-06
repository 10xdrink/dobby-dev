const CustomerMailTemplate = require("../models/CustomerMailTemplate");
const cloudinary = require("../config/cloudinary");

// Get template by type
exports.getTemplate = async (req, res) => {
  try {
    const { type } = req.params;
    const template = await CustomerMailTemplate.findOne({ templateType: type });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: "Error fetching template", error });
  }
};

// Update or Create template by type
exports.updateTemplate = async (req, res) => {
  try {
    const { type } = req.params;
    let data = req.body;

    data.buttonName = req.body.buttonName;
    data.buttonRedirectLink = req.body.buttonRedirectLink;

    if (typeof data.pageLinks === "string")
      data.pageLinks = JSON.parse(data.pageLinks);
    if (typeof data.socialMediaLinks === "string")
      data.socialMediaLinks = JSON.parse(data.socialMediaLinks);

    let template = await CustomerMailTemplate.findOne({ templateType: type });

    // Handle logo/icon upload via Cloudinary
    if (req.files) {
      if (req.files.logo) {
        if (template?.logoPublicId)
          await cloudinary.uploader.destroy(template.logoPublicId);
        data.logoUrl = req.files.logo[0].path;
        data.logoPublicId = req.files.logo[0].filename;
      }
      if (req.files.icon) {
        if (template?.iconPublicId)
          await cloudinary.uploader.destroy(template.iconPublicId);
        data.iconUrl = req.files.icon[0].path;
        data.iconPublicId = req.files.icon[0].filename;
      }
    }

    if (template) {
      template.set(data);
    } else {
      template = new CustomerMailTemplate({ ...data, templateType: type });
    }

    await template.save();

    res.json({ message: "Template updated successfully", template });
  } catch (error) {
    console.error("updateTemplate error:", error);
    res.status(500).json({ message: "Error updating template", error });
  }
};
