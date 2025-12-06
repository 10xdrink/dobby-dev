const Payment = require("../models/Payment");
const Shop = require("../models/Shop");

const checkShopPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // SECURITY: Check if user already has an active shop
    const existingShop = await Shop.findOne({ owner: userId });
    if (existingShop && existingShop.status === "active") {
      return next(); // Already has shop — skip payment check
    }

    // SECURITY: Find latest shop payment that's paid (not used yet)
    // Only allow payment with status "paid" (not "used") for shop creation
    const payment = await Payment.findOne({
      owner: userId,
      type: "shop",
      status: "paid", // Only allow paid payments, not used ones
    }).sort({ createdAt: -1 });

    if (!payment) {
      return res.status(403).json({
        message: "Payment required to create shop. Please complete payment first.",
      });
    }

    // SECURITY: Check if payment is already used for another shop
    if (payment.status === "used") {
      // Check if shop exists for this payment
      const shopForPayment = await Shop.findOne({ payment: payment._id });
      if (shopForPayment) {
        return res.status(403).json({
          message: "This payment has already been used to create a shop",
        });
      }
      // If payment is used but no shop found, allow reuse (edge case)
      req.payment = payment;
      return next();
    }

    // SECURITY: Verify payment is actually paid
    if (payment.status !== "paid") {
      return res.status(403).json({
        message: "Payment not completed. Please complete payment first.",
      });
    }

    req.payment = payment;
    next();
  } catch (err) {
    console.error("checkShopPayment middleware error:", err);
    res.status(500).json({ message: "Server error while verifying payment" });
  }
};

module.exports = checkShopPayment;
