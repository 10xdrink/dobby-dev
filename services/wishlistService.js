const Wishlist = require("../models/Wishlist");
const Product = require("../models/productModel");
const Customer = require("../models/Customer");
const mongoose = require("mongoose");

class WishlistService {
  async addToWishlist({ user, body }) {
    // Require authentication - user must be logged in
    if (!user || !user._id) {
      throw new Error("Please login to add items to wishlist");
    }
    
    const customerId = user._id;
    const { productId } = body;

    const product = await Product.findById(productId);
    if (!product || product.status !== "active")
      throw new Error("Product not found or inactive");

    let wishlist = await Wishlist.findOne({ customer: customerId });
    if (!wishlist) wishlist = new Wishlist({ customer: customerId, items: [] });

    // If product is already in wishlist, just return success (idempotent operation)
    if (wishlist.hasProduct(productId)) {
      const populatedWishlist = await wishlist.populate("items.product", "productName unitPrice icon1 status");
      const activeItems = populatedWishlist.items.filter(
        (i) => i.product && i.product.status === "active"
      );
      return { success: true, items: activeItems, message: "Product already in wishlist" };
    }

    wishlist.items.push({ product: productId });
    await wishlist.save();
    
    const populatedWishlist = await wishlist.populate("items.product", "productName unitPrice icon1 status");
    
    const activeItems = populatedWishlist.items.filter(
      (i) => i.product && i.product.status === "active"
    );
    
    return { success: true, items: activeItems };
  }

  async getWishlist({ user }) {
    // Require authentication - user must be logged in
    if (!user || !user._id) {
      throw new Error("Please login to view wishlist");
    }
    
    const customerId = user._id;
    const wishlist = await Wishlist.findOne({ customer: customerId })
      .populate("items.product", "productName unitPrice icon1 status");

    if (!wishlist) return { success: true, items: [] };

    const activeItems = wishlist.items.filter(
      (i) => i.product && i.product.status === "active"
    );

    return { success: true, items: activeItems };
  }


  async removeFromWishlist({ user, params }) {
    // Require authentication - user must be logged in
    if (!user || !user._id) {
      throw new Error("Please login to manage wishlist");
    }
    
    const customerId = user._id;
    const { productId } = params;

    const wishlist = await Wishlist.findOne({ customer: customerId });
    // If wishlist doesn't exist, the product is already not in wishlist (desired state achieved)
    if (!wishlist) return { success: true, items: [], message: "Product not in wishlist" };

    console.log('[WISHLIST SERVICE] Before delete, items:', wishlist.items.length);
    console.log('[WISHLIST SERVICE] Product ID to remove:', productId);
    console.log('[WISHLIST SERVICE] Item IDs in wishlist:', wishlist.items.map(i => i.product.toString()));
    
    const beforeLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
      (i) => i.product.toString() !== productId
    );
    const afterLength = wishlist.items.length;
    
    console.log('[WISHLIST SERVICE] After filter, items:', afterLength);
    console.log('[WISHLIST SERVICE] Items removed:', beforeLength - afterLength);
    
    await wishlist.save();
    
    const populatedWishlist = await wishlist.populate("items.product", "productName unitPrice icon1 status");
    
    const activeItems = populatedWishlist.items.filter(
      (i) => i.product && i.product.status === "active"
    );
    
    return { success: true, items: activeItems };
  }

  async clearWishlist({ user }) {
    // Require authentication - user must be logged in
    if (!user || !user._id) {
      throw new Error("Please login to manage wishlist");
    }
    
    const customerId = user._id;
    const wishlist = await Wishlist.findOne({ customer: customerId });

    // If wishlist doesn't exist, it's already empty (desired state achieved)
    if (!wishlist) return { success: true, items: [], message: "Wishlist already empty" };

    wishlist.items = [];
    await wishlist.save();
    
    return { success: true, items: [] };
  }
}

module.exports = new WishlistService();




