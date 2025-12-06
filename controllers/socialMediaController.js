const SocialMedia = require("../models/SocialMedia");
const cloudinary = require("../config/cloudinary");

function isValidURL(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (err) {
    return false;
  }
}

// Create Social Media
exports.createSocialMedia = async (req, res) => {
  try {
    const { name, link, iconUrl, iconPublicId } = req.body;

    if (!name || !link) {
      return res.status(400).json({ message: "All fields required (name, link)" });
    }

    if (!isValidURL(link)) {
      return res.status(400).json({ message: "Invalid link URL" });
    }

    const exist = await SocialMedia.findOne({ name });
    if (exist) {
      return res.status(400).json({ message: `${name} already added` });
    }

    const social = new SocialMedia({
      name,
      link,
      iconUrl,
      iconPublicId,
      status: false,
    });

    await social.save();
    res.status(201).json({ message: "Social media created", data: social });
  } catch (err) {
    console.error("createSocialMedia error:", err);
    res.status(500).json({ message: err.message });
  }
};


// Get All
exports.getAllSocialMedia = async (req, res) => {
  try {
    const socials = await SocialMedia.find().sort({ createdAt: -1 });
    res.status(200).json(socials);
  } catch (err) {
    console.error("getAllSocialMedia error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get Active
exports.getActiveSocialMedia = async (req, res) => {
  try {
    const socials = await SocialMedia.find({ status: true }).sort({ createdAt: -1 });
    res.status(200).json(socials);
  } catch (err) {
    console.error("getActiveSocialMedia error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Update
exports.updateSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, link, status, iconUrl, iconPublicId } = req.body;

    const existing = await SocialMedia.findById(id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    if (link && !isValidURL(link)) {
      return res.status(400).json({ message: "Invalid link URL" });
    }

    existing.name = name ?? existing.name;
    existing.link = link ?? existing.link;
    existing.status = status ?? existing.status;
    existing.iconUrl = iconUrl ?? existing.iconUrl;
    existing.iconPublicId = iconPublicId ?? existing.iconPublicId;

    await existing.save();

    res.status(200).json({ message: "Updated successfully", data: existing });
  } catch (err) {
    console.error("updateSocialMedia error:", err);
    res.status(500).json({ message: err.message });
  }
};


// Delete
exports.deleteSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const social = await SocialMedia.findById(id);
    if (!social) return res.status(404).json({ message: "Not found" });

   
    if (social.iconPublicId) {
      try {
        await cloudinary.uploader.destroy(social.iconPublicId);
        console.log(`🗑️ Cloudinary icon deleted: ${social.iconPublicId}`);
      } catch (err) {
        console.error("⚠️ Cloudinary deletion failed:", err.message);
      }
    }

   
    await SocialMedia.findByIdAndDelete(id);

    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("deleteSocialMedia error:", err);
    res.status(500).json({ message: err.message });
  }
};
