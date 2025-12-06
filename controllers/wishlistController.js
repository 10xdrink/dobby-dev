const wishlistService = require("../services/wishlistService");
const { successResponse, errorResponse } = require("../utils/responseHandler");

exports.addToWishlist = async (req, res) => {
  try {
    console.log('[WISHLIST] Adding product:', req.body.productId);
    const wishlist = await wishlistService.addToWishlist(req);
    console.log('[WISHLIST] Product added successfully, total items:', wishlist.items?.length);
    successResponse(res, wishlist);
  } catch (err) {
    console.error('[WISHLIST] Error adding product:', err.message);
    errorResponse(res, err);
  }
};

exports.getWishlist = async (req, res) => {
  try {
    console.log('[WISHLIST] Getting wishlist');
    const wishlist = await wishlistService.getWishlist(req);
    console.log('[WISHLIST] Retrieved wishlist, items:', wishlist.items?.length);
    successResponse(res, wishlist);
  } catch (err) {
    console.error('[WISHLIST] Error getting wishlist:', err.message);
    errorResponse(res, err);
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    console.log('[WISHLIST] Removing product:', req.params.productId);
    const wishlist = await wishlistService.removeFromWishlist(req);
    console.log('[WISHLIST] Product removed, remaining items:', wishlist.items?.length);
    successResponse(res, wishlist);
  } catch (err) {
    console.error('[WISHLIST] Error removing product:', err.message);
    errorResponse(res, err);
  }
};

exports.clearWishlist = async (req, res) => {
  try {
    const result = await wishlistService.clearWishlist(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};
