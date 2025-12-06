const Shop = require("../models/Shop");

const checkActiveShop = async (req, res, next) => {
  try {
    const userId = req.user.id;

   
    const shop = await Shop.findOne({ owner: userId, status: "active" });
    if (!shop) {
      return res
        .status(403)
        .json({ message: "Active shop required to manage products" });
    }

   
    req.shop = shop;
    next();
  } catch (err) {
    console.error("checkActiveShop error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = checkActiveShop;
