const TrustedLogo = require("../models/TrustedLogo");
const cloudinary = require("../config/cloudinary");
const logger = require("../config/logger");

// Helper to delete image safely from Cloudinary
const safeDeleteCloudinary = async (publicId, requestId) => {
  if (!publicId) return;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info({
      requestId,
      action: "cloudinary_delete",
      publicId,
      result,
    });
  } catch (err) {
    logger.error({
      requestId,
      action: "cloudinary_delete_failed",
      error: err.message,
    });
  }
};

// Create a new logo
exports.createLogo = async (req, res) => {
  const { requestId } = req;
  try {
    if (!req.file || !req.file.path || !req.file.filename) {
      logger.warn({ requestId, action: "create_logo", message: "No image uploaded" });
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const logo = await TrustedLogo.create({
      imageUrl: req.file.path,
      imagePublicId: req.file.filename,
    });

    logger.info({
      requestId,
      action: "create_logo",
      logoId: logo._id,
      imagePublicId: logo.imagePublicId,
    });

    res.status(201).json({ success: true, data: logo });
  } catch (err) {
    logger.error({ requestId, action: "create_logo_failed", error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all logos
exports.getAllLogos = async (req, res) => {
  const { requestId } = req;
  try {
    const logos = await TrustedLogo.find().sort({ createdAt: -1 });
    res.json({ success: true, data: logos });
  } catch (err) {
    logger.error({ requestId, action: "get_all_logos_failed", error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update logo (replace image)
exports.updateLogo = async (req, res) => {
  const { id } = req.params;
  const { requestId } = req;

  try {
    const existingLogo = await TrustedLogo.findById(id);
    if (!existingLogo) {
      return res.status(404).json({ success: false, message: "Logo not found" });
    }

    if (!req.file || !req.file.path || !req.file.filename) {
      return res.status(400).json({ success: false, message: "New image required" });
    }

    // Delete old image
    await safeDeleteCloudinary(existingLogo.imagePublicId, requestId);

    // Update with new image
    existingLogo.imageUrl = req.file.path;
    existingLogo.imagePublicId = req.file.filename;

    await existingLogo.save();

    logger.info({
      requestId,
      action: "update_logo",
      logoId: existingLogo._id,
      newImagePublicId: existingLogo.imagePublicId,
    });

    res.json({ success: true, data: existingLogo });
  } catch (err) {
    logger.error({ requestId, action: "update_logo_failed", error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Toggle publish/unpublish
exports.togglePublish = async (req, res) => {
  const { id } = req.params;
  const { requestId } = req;

  try {
    const logo = await TrustedLogo.findById(id);
    if (!logo) return res.status(404).json({ success: false, message: "Logo not found" });

    logo.published = !logo.published;
    await logo.save();

    logger.info({
      requestId,
      action: "toggle_publish",
      logoId: logo._id,
      published: logo.published,
    });

    res.json({ success: true, data: logo });
  } catch (err) {
    logger.error({ requestId, action: "toggle_publish_failed", error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete logo
exports.deleteLogo = async (req, res) => {
  const { id } = req.params;
  const { requestId } = req;

  try {
    const logo = await TrustedLogo.findById(id);
    if (!logo) return res.status(404).json({ success: false, message: "Logo not found" });

    await safeDeleteCloudinary(logo.imagePublicId, requestId);
    await TrustedLogo.findByIdAndDelete(id);

    logger.info({
      requestId,
      action: "delete_logo",
      logoId: id,
    });

    res.json({ success: true, message: "Logo deleted successfully" });
  } catch (err) {
    logger.error({ requestId, action: "delete_logo_failed", error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get only published logos (for homepage)
exports.getPublishedLogos = async (req, res) => {
  const { requestId } = req;
  try {
    const logos = await TrustedLogo.find({ published: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: logos });
  } catch (err) {
    logger.error({ requestId, action: "get_published_logos_failed", error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};
