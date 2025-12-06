const HomepageSlider = require("../models/Slider");
const cloudinary = require("../config/cloudinary");
const logger = require("../config/logger");

// Helper to safely delete Cloudinary image
const safeDeleteCloudinary = async (publicId, requestId) => {
  if (!publicId) return;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info({
      requestId,
      action: "cloudinary_delete",
      publicId,
      result: result.result
    });
  } catch (error) {
    logger.error({
      requestId,
      action: "cloudinary_delete_failed",
      publicId,
      message: error.message,
      stack: error.stack
    });
  }
};

// Utility to sanitize sensitive fields
const sanitize = (obj) => {
  if (!obj) return {};
  const copy = { ...obj };
  if (copy.password) copy.password = "***";
  if (copy.token) copy.token = "***";
  return copy;
};

// Create Slider
exports.createSlider = async (req, res) => {
  const requestId = req.requestId;
  try {
    const { title, subtitle, buttonText } = req.body;

    if (!title || !req.file) {
      logger.warn({
        requestId,
        action: "create_slider_failed",
        reason: "Missing title or image",
        body: sanitize(req.body)
      });
      return res.status(400).json({ error: "Title and image are required" });
    }

    const slider = await HomepageSlider.create({
      title,
      subtitle,
      buttonText,
      imageUrl: req.file.path,
      imagePublicId: req.file.filename
    });

    logger.info({
      requestId,
      action: "slider_created",
      sliderId: slider._id
    });

    return res.status(201).json({ success: true, slider });
  } catch (error) {
    logger.error({
      requestId,
      action: "create_slider_error",
      message: error.message,
      stack: error.stack,
      body: sanitize(req.body)
    });
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get All Sliders
exports.getAllSliders = async (req, res) => {
  const requestId = req.requestId;
  try {
    const sliders = await HomepageSlider.find().sort({ createdAt: -1 });
    logger.debug({
      requestId,
      action: "get_all_sliders",
      count: sliders.length
    });
    res.json({ success: true, sliders });
  } catch (error) {
    logger.error({
      requestId,
      action: "get_all_sliders_failed",
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Failed to retrieve sliders" });
  }
};

// Update Slider
exports.updateSlider = async (req, res) => {
  const requestId = req.requestId;
  try {
    const { id } = req.params;
    const { title, subtitle, buttonText } = req.body;

    const slider = await HomepageSlider.findById(id);
    if (!slider) {
      logger.warn({ requestId, action: "update_slider_failed", reason: "Slider not found", sliderId: id });
      return res.status(404).json({ error: "Slider not found" });
    }

    if (req.file) {
      await safeDeleteCloudinary(slider.imagePublicId, requestId);
      slider.imageUrl = req.file.path;
      slider.imagePublicId = req.file.filename;
    }

    if (title) slider.title = title;
    if (subtitle) slider.subtitle = subtitle;
    if (buttonText) slider.buttonText = buttonText;

    await slider.save();

    logger.info({ requestId, action: "slider_updated", sliderId: slider._id });
    res.json({ success: true, slider });
  } catch (error) {
    logger.error({ requestId, action: "update_slider_error", message: error.message, stack: error.stack });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete Slider
exports.deleteSlider = async (req, res) => {
  const requestId = req.requestId;
  try {
    const { id } = req.params;
    const slider = await HomepageSlider.findById(id);

    if (!slider) {
      logger.warn({ requestId, action: "delete_slider_failed", reason: "Slider not found", sliderId: id });
      return res.status(404).json({ error: "Slider not found" });
    }

    await safeDeleteCloudinary(slider.imagePublicId, requestId);
    await slider.deleteOne();

    logger.info({ requestId, action: "slider_deleted", sliderId: id });
    res.json({ success: true, message: "Slider deleted" });
  } catch (error) {
    logger.error({ requestId, action: "delete_slider_error", message: error.message, stack: error.stack });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Toggle Publish
exports.togglePublish = async (req, res) => {
  const requestId = req.requestId;
  try {
    const { id } = req.params;
    const slider = await HomepageSlider.findById(id);

    if (!slider) {
      logger.warn({ requestId, action: "toggle_publish_failed", reason: "Slider not found", sliderId: id });
      return res.status(404).json({ error: "Slider not found" });
    }

    slider.published = !slider.published;
    await slider.save();

    logger.info({ requestId, action: "slider_toggle_publish", sliderId: slider._id, published: slider.published });
    res.json({ success: true, slider });
  } catch (error) {
    logger.error({ requestId, action: "toggle_publish_error", message: error.message, stack: error.stack });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Only Published Sliders
exports.getPublishedSliders = async (req, res) => {
  const requestId = req.requestId;
  try {
    const sliders = await HomepageSlider.find({ published: true }).sort({ createdAt: -1 });

    logger.debug({ requestId, action: "get_published_sliders", count: sliders.length });
    res.json({ success: true, sliders });
  } catch (error) {
    logger.error({ requestId, action: "get_published_sliders_error", message: error.message, stack: error.stack });
    res.status(500).json({ error: "Internal Server Error" });
  }
};
