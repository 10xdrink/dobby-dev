const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let resourceType = "image"; 

    
    if (file.mimetype.startsWith("video/")) {
      resourceType = "video";
    }

    return {
      folder: "dobbyMall",
      resource_type: resourceType,
      allowed_formats: ["jpg", "png", "jpeg", "gif", "ico", "svg", "webp", "mp4", "wmv", "mkv", "avi"],
    };
  },
});

const upload = multer({ storage });

module.exports = upload;
