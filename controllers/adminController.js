const User = require('../models/User');
const ShopReview = require('../models/ShopReview');

const SupplierMailTemplate = require("../models/SupplierMailTemplate")
const { sendEmail } = require('../utils/mailer');
const Shop = require('../models/Shop');
const Product = require("../models/productModel");
const cloudinary = require("../config/cloudinary");
const logger = require("../config/logger");
const crypto = require("crypto");




async function sendSupplierTemplateMail(to, type, placeholders = {}) {
  const template = await SupplierMailTemplate.findOne({ templateType: type });
  if (!template || !template.isActive) {
    console.log(` Supplier Template not found or inactive: ${type}`);
    return;
  }

  
  let mailBody = template.mailBody;
for (const [key, value] of Object.entries(placeholders)) {
  const regex = new RegExp(`{${key}}`, "gi"); 
  mailBody = mailBody.replace(regex, value);
}

  
  let pageLinksHtml = "";
  for (const [key, value] of Object.entries(template.pageLinks || {})) {
    if (value.enabled) {
      pageLinksHtml += `<a href="${value.url}" style="margin:0 8px; color:#000; text-decoration:none; text-transform:capitalize;">
  ${key.replace(/([A-Z])/g, ' $1')}
</a>`;

    }
  }

  
const iconMap = {
  facebook: "https://res.cloudinary.com/demo/image/upload/v1729600000/facebook-black.png",
  instagram: "https://res.cloudinary.com/demo/image/upload/v1729600000/instagram-black.png",
  x: "https://res.cloudinary.com/demo/image/upload/v1729600000/x-black.png",
  linkedin: "https://res.cloudinary.com/demo/image/upload/v1729600000/linkedin-black.png",
  youtube: "https://res.cloudinary.com/demo/image/upload/v1729600000/youtube-black.png"
};

let socialLinksHtml = "";
for (const [key, value] of Object.entries(template.socialMediaLinks || {})) {
  if (value.enabled && value.url) {
    const iconUrl = iconMap[key.toLowerCase()] || "https://res.cloudinary.com/demo/image/upload/v1729600000/link-black.png";
    socialLinksHtml += `
      <a href="${value.url}" style="margin:0 5px;" target="_blank">
        <img src="${iconUrl}" alt="${key}" height="22" style="vertical-align:middle; display:inline-block;"/>
      </a>
    `;
  }
}

  
  const htmlContent = `
     <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px; background:#fff; border:1px solid #e0e0e0; border-radius:8px;">
    <div style="text-align:center; margin-bottom:20px;">
      <img src="${template.logoUrl}" alt="Logo" style="width:100px; height:100px; object-fit:contain; border-radius:8px;"/>
    </div>
      <h2 style="color:#333;">${template.title}</h2>
      <p style="color:#555; font-size:15px; line-height:1.6;">${mailBody}</p>
      <p style="color:#555; font-size:14px; line-height:1.6;">
        ${template.footerSectionText || ""}
      </p>
      <div style="text-align:center; margin-bottom:20px;">
        <img src="${template.iconUrl}" alt="Logo" style="height:60px;"/>
      </div>
      <div style="margin-top:20px; text-align:center;">${pageLinksHtml}</div>
      <div style="margin-top:20px; text-align:center;">${socialLinksHtml}</div>
      <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;"/>
      <p style="font-size:12px; color:#888; text-align:center;">
        ${template.copyrightText || ""}
      </p>
    </div>
  `;

  await sendEmail(to, template.title, htmlContent);
}



exports.getAllShopkeepers = async (req, res) => {
  try {
    const shopkeepers = await User.find({ role: 'shopkeeper' }).select('-password').lean();

    const shopkeepersWithDetails = await Promise.all(shopkeepers.map(async (shopkeeper) => {
        const shop = await Shop.findOne({ owner: shopkeeper._id }).lean();
        let productCount = 0;
        let reviews = [];
        
        if (shop) {
            productCount = await Product.countDocuments({ shop: shop._id });
            reviews = await ShopReview.find({ shop: shop._id }).sort({ createdAt: -1 }).lean();
        }
        return {
            ...shopkeeper,
            shop: shop || null,
            productCount: productCount,
            reviews: reviews
        };
    }));

    res.json(shopkeepersWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch shopkeepers' });
  }
};

exports.approveShopkeeper = async (req, res) => {
  const { id } = req.params;
  try {
    const shopkeeper = await User.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true }
    );
    if (!shopkeeper) return res.status(404).json({ message: 'Shopkeeper not found' });

    
    const nameForMail = `${shopkeeper.firstName || ""} ${shopkeeper.lastName || ""}`.trim();


   
    await sendSupplierTemplateMail(shopkeeper.email || "no-reply@example.com", "registration_approved", {
      ShopkeeperName: nameForMail
    });

    res.json({ message: 'Shopkeeper approved successfully', shopkeeper });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to approve shopkeeper' });
  }
};


exports.rejectShopkeeper = async (req, res) => {
  const { id } = req.params;
  try {
    const shopkeeper = await User.findByIdAndUpdate(
      id,
      { status: 'rejected' },
      { new: true }
    );
    if (!shopkeeper) return res.status(404).json({ message: 'Shopkeeper not found' });

    
   const nameForMail = `${shopkeeper.firstName || ""} ${shopkeeper.lastName || ""}`.trim();


    
    await sendSupplierTemplateMail(shopkeeper.email || "no-reply@example.com", "registration_rejected", {
      ShopkeeperName: nameForMail
    });

    res.json({ message: 'Shopkeeper rejected successfully', shopkeeper });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to reject shopkeeper' });
  }
};


exports.toggleBlockShopkeeper = async (req, res) => {
  const { id } = req.params;
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.toggleBlockShopkeeper", requestId, shopkeeperId: id };

  try {
    logger.info({ ...context, event: "TOGGLE_BLOCK_START" });

    const shopkeeper = await User.findById(id);
    if (!shopkeeper) {
      logger.warn({ ...context, event: "SHOPKEEPER_NOT_FOUND" });
      return res.status(404).json({ message: 'Shopkeeper not found' });
    }

    shopkeeper.isBlocked = !shopkeeper.isBlocked;
    shopkeeper.blockedAt = shopkeeper.isBlocked ? new Date() : null;
    await shopkeeper.save();

    const shop = await Shop.findOne({ owner: shopkeeper._id });
    if (shop) {
      shop.status = shopkeeper.isBlocked ? "disabled" : "active";
      await shop.save();
      logger.info({ ...context, event: "SHOP_STATUS_UPDATED", shopId: shop._id, newStatus: shop.status });
    }

    
    const nameForMail = `${shopkeeper.firstName || ""} ${shopkeeper.lastName || ""}`.trim();
    const mailTo = shopkeeper.email || "no-reply@example.com";
    const templateType = shopkeeper.isBlocked ? "account_suspended" : "account_activated";

    await sendSupplierTemplateMail(mailTo, templateType, { ShopkeeperName: nameForMail });

    logger.info({ 
      ...context, 
      event: "TOGGLE_BLOCK_SUCCESS", 
      isBlocked: shopkeeper.isBlocked, 
      emailSentTo: mailTo 
    });

    res.json({ 
      message: shopkeeper.isBlocked 
        ? 'Shopkeeper blocked successfully' 
        : 'Shopkeeper unblocked successfully', 
      shopkeeper,
      shop
    });
  } catch (error) {
    logger.error({ ...context, event: "TOGGLE_BLOCK_ERROR", error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to toggle block' });
  }
};



exports.deleteShopkeeper = async (req, res) => {
  const { id } = req.params;
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.deleteShopkeeper", requestId, shopkeeperId: id };

  try {
    logger.info({ ...context, event: "DELETE_SHOPKEEPER_START" });

    const shopkeeper = await User.findOne({ _id: id, role: "shopkeeper" });
    if (!shopkeeper) {
      logger.warn({ ...context, event: "DELETE_SHOPKEEPER_NOT_FOUND" });
      return res.status(404).json({ message: "Shopkeeper not found" });
    }

   
    const shop = await Shop.findOne({ owner: shopkeeper._id });
    if (shop) {
      logger.info({ ...context, event: "DELETE_SHOPKEEPER_SHOP_FOUND", shopId: shop._id });

      
      const deletedProducts = await Product.deleteMany({ shop: shop._id });
      logger.info({ 
        ...context, 
        event: "DELETE_SHOPKEEPER_PRODUCTS_DELETED", 
        shopId: shop._id, 
        count: deletedProducts.deletedCount 
      });

      
      if (shop.image?.public_id) {
        try { await cloudinary.uploader.destroy(shop.image.public_id); } 
        catch (err) { logger.warn({ ...context, event: "DELETE_SHOPKEEPER_IMAGE_FAIL", error: err.message }); }
      }
      if (shop.banner?.public_id) {
        try { await cloudinary.uploader.destroy(shop.banner.public_id); } 
        catch (err) { logger.warn({ ...context, event: "DELETE_SHOPKEEPER_BANNER_FAIL", error: err.message }); }
      }

      await Shop.deleteOne({ _id: shop._id });
    }

    
    if (shopkeeper.profile?.public_id) {
      try {
        await cloudinary.uploader.destroy(shopkeeper.profile.public_id);
      } catch (err) {
        logger.warn({ ...context, event: "DELETE_SHOPKEEPER_PROFILE_IMAGE_FAIL", error: err.message });
      }
    }

    
    await User.deleteOne({ _id: id });

    logger.info({ ...context, event: "DELETE_SHOPKEEPER_SUCCESS" });
    res.json({ message: "Shopkeeper and all associated data deleted successfully" });

  } catch (error) {
    logger.error({ ...context, event: "DELETE_SHOPKEEPER_ERROR", error: error.message, stack: error.stack });
    res.status(500).json({ message: "Failed to delete shopkeeper" });
  }
};

