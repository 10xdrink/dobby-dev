const cloudinary = require("../config/cloudinary");
const Banner = require("../models/banner");
const logger = require("../config/logger");

/**
 * Create a new banner
 */
exports.createBanner = async (req, res) => {
  logger.info("[Banner] Create request received");

  try {
    const { bannerType, bannerUrl, resourceType } = req.body;

    if (!req.file) {
      logger.warn("[Banner] Missing image file");
      return res.status(400).json({ success: false, message: "Image file required" });
    }

    const imageUrl = req.file.path;
    const publicId = req.file.public_id || req.file.filename;

    const newBanner = await Banner.create({
      bannerType,
      bannerUrl,
      resourceType,
      image: imageUrl,
      imagePublicId: publicId,
    });

    logger.info("[Banner] Created successfully", { id: newBanner._id });
    return res.status(201).json({ success: true, data: newBanner });
  } catch (err) {
    logger.error("[Banner] Create failed", { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: "Failed to create banner" });
  }
};

/**
 * Get all banners (Admin)
 */
exports.getBanners = async (req, res) => {
  try {
    logger.info("[Banner] Fetch all banners");
    const banners = await Banner.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: banners });
  } catch (err) {
    logger.error("[Banner] Fetch all failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch banners" });
  }
};

/**
 * Get published banners (Public)
 */
exports.getPublishedBanners = async (req, res) => {
  try {
    const { type } = req.query;
    let filter = { published: true };
    if (type) filter.bannerType = type;

    logger.info("[Banner] Fetch published banners", filter);
    const banners = await Banner.find(filter);
    return res.json({ success: true, data: banners });
  } catch (err) {
    logger.error("[Banner] Fetch published failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch published banners" });
  }
};

/**
 * Update a banner
 */
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { bannerType, bannerUrl, resourceType, published } = req.body;

    logger.info("[Banner] Update request received", { id, body: req.body });

    const banner = await Banner.findById(id);
    if (!banner) {
      logger.warn("[Banner] Banner not found", { id });
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    const updateData = {
      bannerType: bannerType || banner.bannerType,
      bannerUrl: bannerUrl || banner.bannerUrl,
      resourceType: resourceType || banner.resourceType,
      published: published !== undefined ? published : banner.published,
    };

    if (req.file) {
      const newImageUrl = req.file.path;
      const newPublicId = req.file.public_id || req.file.filename;

      logger.info("[Banner] Replacing Cloudinary image", {
        oldPublicId: banner.imagePublicId,
        newPublicId,
      });

      // Delete old image safely
      if (banner.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(banner.imagePublicId, {
            resource_type: banner.resourceType?.toLowerCase() || "image",
          });
          logger.info("[Banner] Old image deleted from Cloudinary", {
            oldPublicId: banner.imagePublicId,
          });
        } catch (destroyErr) {
          logger.error("[Banner] Failed to delete old Cloudinary image", {
            error: destroyErr.message,
          });
        }
      }

      updateData.image = newImageUrl;
      updateData.imagePublicId = newPublicId;
    }

    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, { new: true });
    logger.info("[Banner] Updated successfully", { id: updatedBanner._id });
    return res.json({ success: true, data: updatedBanner });
  } catch (err) {
    logger.error("[Banner] Update failed", { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: "Failed to update banner" });
  }
};

/**
 * Delete a banner
 */
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("[Banner] Delete request received", { id });

    const banner = await Banner.findById(id);
    if (!banner) {
      logger.warn("[Banner] Banner not found for delete", { id });
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    if (banner.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(banner.imagePublicId, {
          resource_type: banner.resourceType?.toLowerCase() || "image",
        });
        logger.info("[Banner] Cloudinary image deleted", { publicId: banner.imagePublicId });
      } catch (destroyErr) {
        logger.error("[Banner] Cloudinary delete failed", { error: destroyErr.message });
      }
    }

    await Banner.findByIdAndDelete(id);
    logger.info("[Banner] Deleted successfully", { id });
    return res.json({ success: true, message: "Banner deleted successfully" });
  } catch (err) {
    logger.error("[Banner] Delete failed", { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: "Failed to delete banner" });
  }
};
