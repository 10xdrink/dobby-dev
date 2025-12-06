const mongoose = require("mongoose");
const Shop = require("../models/Shop");
const ShopSortSetting = require("../models/ShopSortSetting");
const { createAndEmitNotification } = require("../helpers/notification");
const Product = require("../models/productModel")
const User = require("../models/User");


const ReferralHistory = require("../models/ReferralHistory");
const Student = require("../models/student");

const cloudinary = require("../config/cloudinary");

// Create Shop
const createShop = async (req, res) => {
  try {
    const userId = req.user.id;

    // SECURITY: Prevent duplicate shop creation
    const existingShop = await Shop.findOne({ owner: userId });
    if (existingShop) {
      return res.status(400).json({ message: "You already have a shop" });
    }

    // SECURITY: Ensure payment exists and is valid (from middleware)
    const payment = req.payment;
    if (!payment || !payment._id) {
      return res.status(403).json({ message: "Payment required to create shop" });
    }

    // SECURITY: Verify payment is paid (double check)
    if (payment.status !== "paid" && payment.status !== "used") {
      return res.status(403).json({ 
        message: "Payment not completed. Please complete payment first." 
      });
    }

    // SECURITY: Check if payment is already used for another shop
    if (payment.status === "used") {
      const shopForPayment = await Shop.findOne({ payment: payment._id });
      if (shopForPayment && shopForPayment.owner.toString() !== userId.toString()) {
        return res.status(403).json({ 
          message: "This payment has already been used" 
        });
      }
    }

    const paymentId = payment._id;

     let image = {};
    let banner = {};

    // Upload to Cloudinary
    if (req.files?.imageUrl) {
      const result = await cloudinary.uploader.upload(req.files.imageUrl[0].path, {
        folder: "dobbyMall/shops",
      });
      image = { url: result.secure_url, public_id: result.public_id };
    }

    if (req.files?.bannerUrl) {
      const result = await cloudinary.uploader.upload(req.files.bannerUrl[0].path, {
        folder: "dobbyMall/shops",
      });
      banner = { url: result.secure_url, public_id: result.public_id };
    }


    const newShop = await Shop.create({
      ...req.body,
      owner: userId,
      payment: paymentId,
      status: "active",
      image,
      banner, // Shop becomes active after payment
    });

    // SECURITY: Mark payment as used after shop creation (prevent reuse)
    if (payment && payment.status === 'paid') {
      payment.status = 'used';
      await payment.save();
    }


if (newShop.status === "active") {
 
  const shopkeeper = await User.findById(userId);
  let studentId = shopkeeper.referredBy; 
  if (!studentId && shopkeeper.refBy) { 
    const st = await Student.findOne({ affiliateCode: shopkeeper.refBy });
    studentId = st ? st._id : null;
  }
  if (studentId) {
    await ReferralHistory.create({
      studentId,
      shopkeeperId: shopkeeper._id,
      shopId: newShop._id,
      amount: 1000,
      status: "pending"
    });
  }
  console.log("Referral created for student:", studentId);

  createAndEmitNotification({
        title: "Referral Shop is LIVE! ",
        message: `Congratulations! The  ${newShop.shopName} created by your referred shopkeeper is now active.`,
        event: "referral-shop-active",
        targetUsers: [
            { userId: studentId, userModel: "Student" }
        ],
        meta: { 
            shopId: newShop._id, 
            shopName: newShop.shopName,
            shopkeeperId: shopkeeper._id,
            stage: 'activation'
        }
    });

}



    res.status(201).json({ success: true, shop: newShop });

    
  } catch (error) {
    console.error("Create Shop Error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Get all shops
const getAllShops = async (req, res) => {
  try {
    
    let query = { status: "active" };
    let sort = { createdAt: -1 };
    
    const setting = await ShopSortSetting.findOne() || {
      mode: "default",
      customSortOption: "latest_created",
    };

    
    if (setting.mode === "custom") {
      switch (setting.customSortOption) {
        case "first_created":
          sort = { createdAt: 1 };
          break;
        case "latest_created":
          sort = { createdAt: -1 };
          break;
        case "A_to_Z":
          sort = { shopName: 1 };
          break;
        case "Z_to_A":
          sort = { shopName: -1 };
          break;
        case "most_ordered":
          sort = { totalOrders: -1 }; 
          break;
        default:
          sort = { createdAt: -1 };
      }
    }

   
    const shops = await Shop.find(query)
      .populate("owner", "name email")
      .sort(sort)
      .lean();

    res.status(200).json({ success: true, count: shops.length, shops });
  } catch (error) {
    console.error("getAllShops error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get shops for a specific owner
const getShopsByOwner = async (req, res) => {
  try {
    if (!req.user || !mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({ message: "Invalid or missing owner ID" });
    }

    const shops = await Shop.find({ owner: req.user.id });
    res.status(200).json(shops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get single shop by ID

const getShopById = async (req, res) => {
  try {
    const shopId = req.params.id;

   
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }

   
    const shop = await Shop.findOne({ _id: shopId, status: "active" })
      .populate("owner", "name email");

    if (!shop) {
      return res.status(404).json({ message: "Shop not found or inactive" });
    }

    
    const products = await Product.find({ shop: shop._id, status: "active" })
      .select("productName description unit unitPrice discountType discountValue finalPrice priceWithTax category subCategory icon1 currentStock")
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort({ createdAt: -1 });

    
    res.status(200).json({
      success: true,
      shop,
      products,
    });

  } catch (error) {
    console.error("getShopById error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update shop

const updateShop = async (req, res) => {
  try {
    const shopId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Ownership check
    if (shop.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    //  Restrict sensitive fields
    delete req.body.owner;
    delete req.body.payment;
    delete req.body.status;

     // Handle Cloudinary file replacement
     let updatedData = { ...req.body };

    //  Update image if new uploaded
    if (req.files?.imageUrl) {
      if (shop.image?.public_id) {
        await cloudinary.uploader.destroy(shop.image.public_id);
      }
      const result = await cloudinary.uploader.upload(req.files.imageUrl[0].path, {
        folder: "dobbyMall/shops",
      });
      updatedData.image = { url: result.secure_url, public_id: result.public_id };
    }

    //  Update banner if new uploaded
    if (req.files?.bannerUrl) {
      if (shop.banner?.public_id) {
        await cloudinary.uploader.destroy(shop.banner.public_id);
      }
      const result = await cloudinary.uploader.upload(req.files.bannerUrl[0].path, {
        folder: "dobbyMall/shops",
      });
      updatedData.banner = { url: result.secure_url, public_id: result.public_id };
    }
const updatedShop = await Shop.findByIdAndUpdate(
  shopId,
  { $set: updatedData },
  { new: true, runValidators: true }
);



    res.status(200).json(updatedShop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete shop

const deleteShop = async (req, res) => {
  try {
    const shopId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }

    
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Ownership check
    if (shop.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

     // Delete images from Cloudinary
    
    if (shop.image?.public_id) await cloudinary.uploader.destroy(shop.image.public_id);
    if (shop.banner?.public_id) await cloudinary.uploader.destroy(shop.banner.public_id);



    
    await Shop.findByIdAndDelete(shopId);
    res.status(200).json({ message: "Shop deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPublicIdFromUrl = (url) => {
  try {
    const parts = url.split("/");
    const fileName = parts.pop().split(".")[0];
    const folder = parts.slice(parts.indexOf("dobbyMall")).join("/");
    return folder + "/" + fileName;
  } catch {
    return null;
  }
};



module.exports = {
  createShop,
  getAllShops,
  getShopsByOwner,
  getShopById,
  updateShop,
  deleteShop,
};