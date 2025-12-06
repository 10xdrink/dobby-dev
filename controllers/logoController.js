const Logo = require("../models/logo");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const deleteFromCloudinary = async (url) => {
  if (!url) return;
  try {
    const parts = url.split("/");
    const publicIdWithExt = parts.pop();
    const folder = parts.slice(-1)[0]; 
    const publicId = publicIdWithExt.split(".")[0];
    await cloudinary.uploader.destroy(`${folder}/${publicId}`);
  } catch (err) {
    console.error(" Cloudinary delete error:", err.message);
  }
};

exports.updateLogo = async (req, res) => {
  try {
    let logo = await Logo.findOne();
    if (!logo) {
      logo = new Logo({});
    }

    
    const types = ["headerLogo", "footerLogo", "favicon", "loadingGif"];
    for (const type of types) {
      if (req.files && req.files[type]) {
        
        if (logo[type]) {
          await deleteFromCloudinary(logo[type]);
        }

        
        const result = await cloudinary.uploader.upload(
          req.files[type][0].path,
          {
            folder: "dobbyMall",
            public_id: `${type}-${Date.now()}`,
            resource_type: "image",
          }
        );

        logo[type] = result.secure_url;
      }
    }

    await logo.save();

    res.status(200).json({
      success: true,
      message: "Logos updated successfully",
      data: logo,
    });
  } catch (err) {
    console.error(" Update Logo Error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getLogo = async (req, res) => {
  try {
    const { type } = req.query;

    let logo = await Logo.findOne();
    if (!logo) {
      logo = new Logo({});
      await logo.save();
    }

    if (type) {
      return res.json({ [type]: logo[type] || "" });
    }

    res.json(logo);
  } catch (err) {
    console.error(" Get Logo Error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
