const Cart = require("../models/Cart");
const AbandonedCart = require("../models/AbandonedCart");
const Coupon = require("../models/Coupon");
const Product = require("../models/productModel");
const FlashSale = require("../models/FlashSale");
const logger = require("../config/logger");
const taxService = require("../services/taxService"); 
const pricingRuleService = require("../services/pricingruleService"); 
const shippingCalculator = require("../services/shippingCalculator");

class CartService {
  async addToCart({ user, body }) {
    const customerId = user?._id || user?.id || null;
    const { productId, quantity, sessionId } = body;

    logger.info(
      ` addToCart called by ${
        customerId || "guest"
      } | product=${productId} | qty=${quantity} | user=${JSON.stringify(user)} | sessionId=${sessionId}`
    );

    if (!sessionId && !customerId) {
      logger.error(` Session ID or login required | user=${JSON.stringify(user)} | body=${JSON.stringify(body)}`);
      throw new Error("Session ID or login required");
    }

    // Auto-merge if user is logged in and sessionId is present
    if (customerId && sessionId) {
      try {
        await this.mergeGuestCart({ user, body: { sessionId } });
      } catch (err) {
        logger.warn(`Auto-merge failed in addToCart: ${err.message}`);
      }
    }

    const product = await Product.findById(productId).populate("shop");

    if (!product || product.status !== "active") {
      logger.error(` Product not found or inactive: ${productId}`);
      throw new Error("Product not found or inactive");
    }

    
    if (!product.shop || product.shop.status !== "active") {
      logger.error(` Product's shop is inactive: ${productId}`);
      throw new Error("Product's shop is not active");
    }

    logger.debug(` Product fetched: ${product.productName || productId}`);
    logger.debug(
      ` Populated shop: ${product.shop ? product.shop._id : "None"}`
    );

    const shopId = product.shop?._id || product.shop;

    logger.info(` Extracted shopId = ${shopId}`);

    if (!shopId) {
      logger.error(` Product ${productId} has no associated shop`);
      throw new Error("Product missing associated shop");
    }

    if (product.currentStock < quantity) {
      logger.warn(
        ` Insufficient stock for product ${productId} | Requested=${quantity} | Available=${product.currentStock}`
      );
      throw new Error("Insufficient stock");
    }

    if (quantity < product.minOrderQty) {
      logger.warn(
        ` Quantity below minOrder for product ${productId} | Requested=${quantity}, min=${product.minOrderQty}`
      );
      throw new Error(`Minimum order quantity is ${product.minOrderQty}`);
    }

    let cart;

    if (customerId) {
      cart = await Cart.findOne({ customer: customerId });
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId });
    }
    if (!cart) {
      const customerModel = user?.role === 'student' ? 'Student' : 'Customer';
      cart = new Cart({ 
        customer: customerId, 
        customerModel,
        sessionId, 
        items: [] 
      });
      logger.info(` New cart created for ${customerId || "guest"} (${customerModel})`);
    } else if (!cart.customer && customerId) {
      cart.customer = customerId;
      cart.customerModel = user?.role === 'student' ? 'Student' : 'Customer';
      logger.info(` Guest cart now linked to user ${customerId} (${cart.customerModel})`);
    }

    const existingItem = cart.items.find(
      (i) => i.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      logger.info(
        ` Updated product ${productId} quantity → ${existingItem.quantity}`
      );
    } else {
      logger.debug(` Adding product ${productId} (shop=${shopId}) to cart`);
      cart.items.push({
        product: productId,
        shop: shopId,
        quantity,
        priceAtAddition: product.priceWithTax || product.unitPrice,
      });
    }

    try {
      const abandonedFilter = customerId
        ? { customer: customerId, product: productId, shop: shopId }
        : { sessionId, product: productId, shop: shopId };

      await AbandonedCart.findOneAndUpdate(
        abandonedFilter,
        {
          $set: {
            shop: shopId,
            quantity,
            value: (product.priceWithTax || product.unitPrice) * quantity,
            status: "pending",
            abandonedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      logger.info(
        ` AbandonedCart updated for product ${productId} (shop=${shopId})`
      );
    } catch (err) {
      logger.error(" Error updating AbandonedCart: " + err.message);
    }

    await this._recalculateCart(cart);
    await cart.save();

    logger.info(
      ` Cart saved for ${customerId || "guest"} | totalAmount=${
        cart.totalAmount
      } | shippingAmount=${cart.shippingAmount || 0}`
    );

    return cart;
  }
  
  async getCart({ user, query }) {
    const customerId = user?._id || user?.id || null;
    const sessionId = query.sessionId;

    logger.info(
      ` getCart called by ${customerId || "guest"} | sessionId=${sessionId} | user=${JSON.stringify(user)}`
    );

    // Auto-merge if user is logged in and sessionId is present
    if (customerId && sessionId) {
      try {
        await this.mergeGuestCart({ user, body: { sessionId } });
      } catch (err) {
        logger.warn(`Auto-merge failed in getCart: ${err.message}`);
      }
    }

    const filter = customerId ? { customer: customerId } : { sessionId };
    logger.info(` Searching cart with filter: ${JSON.stringify(filter)}`);
    
    const cart = await Cart.findOne(filter)
      .populate(
        "items.product",
        "productName unitPrice icon1 currentStock shippingCost discountType discountValue taxType"
      )
      .populate("items.shop", "shopName");

    logger.info(` Cart found: ${cart ? `Yes, ${cart.items.length} items` : 'No cart found'}`);

    if (!cart) {
      logger.warn(` No cart found for filter ${JSON.stringify(filter)}, returning empty cart`);
      return {
        items: [],
        totalAmount: 0,
        shippingAmount: 0,
        shippingBreakdown: [],
        appliedCoupon: null,
      };
    }

    await this._recalculateCart(cart);

    logger.info(` Returning cart with ${cart.items.length} items, totalAmount=${cart.totalAmount}`);
    return cart;
  }

  async updateCartItemQuantity({ user, body, params }) {
    const customerId = user?._id || user?.id || null;
    const sessionId = body?.sessionId || null;
    const { productId } = params;
    const { quantity } = body;

    logger.info(
      `updateCartItemQuantity called by ${
        customerId || "guest"
      } for product ${productId} | new qty=${quantity}`
    );

    if (!sessionId && !customerId) {
      logger.error("Session ID or login required");
      throw new Error("Session ID or login required");
    }

    if (!quantity || quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    let cart;
    if (customerId) {
      cart = await Cart.findOne({ customer: customerId }).populate(
        "items.product"
      );
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId }).populate("items.product");
    }

    if (!cart) {
      logger.error("Cart not found");
      throw new Error("Cart not found");
    }

    const item = cart.items.find(
      (i) =>
        i.product._id.toString() === productId ||
        i.product.toString() === productId
    );

    if (!item) {
      logger.error(`Product ${productId} not found in cart`);
      throw new Error("Product not found in cart");
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== "active") {
      throw new Error("Product not found or inactive");
    }

    if (quantity < product.minOrderQty) {
      throw new Error(`Minimum order quantity is ${product.minOrderQty}`);
    }

    if (product.currentStock < quantity) {
      throw new Error(`Insufficient stock. Available: ${product.currentStock}`);
    }

    item.quantity = quantity;
    await this._recalculateCart(cart);

    try {
      const shopId = item.shop?.toString() || product.shop?.toString();
      const abandonedFilter = customerId
        ? { customer: customerId, product: productId, shop: shopId }
        : { sessionId, product: productId, shop: shopId };

      await AbandonedCart.findOneAndUpdate(
        abandonedFilter,
        {
          $set: {
            quantity,
            value: (product.priceWithTax || product.unitPrice) * quantity,
            status: "pending",
            abandonedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      logger.info(`AbandonedCart updated for product ${productId}`);
    } catch (err) {
      logger.error("Error updating AbandonedCart: " + err.message);
    }

    await cart.save();

    logger.info(
      `Cart item quantity updated for ${
        customerId || "guest"
      } | product=${productId} | qty=${quantity}`
    );

    return cart;
  }

  async removeFromCart({ user, body, params, query }) {
    const customerId = user?._id || user?.id || null;
    const sessionId = query?.sessionId || body?.sessionId || null;
    const { productId } = params;

    let cart;
    if (customerId) {
      cart = await Cart.findOne({ customer: customerId });
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId });
    }

    logger.info(
      `removeFromCart called by ${
        customerId || "guest"
      } for product ${productId}`
    );
    if (!cart) {
      logger.error("Cart not found");
      throw new Error("Cart not found");
    }

    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    await this._recalculateCart(cart);

    try {
      const abandonedFilter = customerId
        ? { customer: customerId, product: productId }
        : { sessionId, product: productId };

      await AbandonedCart.findOneAndDelete(abandonedFilter);
      logger.info(`AbandonedCart entry removed for product ${productId}`);
    } catch (err) {
      logger.error("Error deleting AbandonedCart entry: " + err.message);
    }

    await cart.save();

    return cart;
  }

   async applyCoupon({ user, body }) {
    const customerId = user?._id || user?.id;
    const { couponCode } = body;

    if (!customerId) {
      throw new Error("Please login to apply coupon");
    }

    const cart = await Cart.findOne({ customer: customerId }).populate("items.product items.shop");
    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      status: "active",
    });

    if (!coupon) {
      throw new Error("Invalid or inactive coupon code");
    }

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new Error("Coupon has expired or not yet valid");
    }

    
    const alreadyUsed = coupon.usedBy.some(
      (usage) => usage.customer.toString() === customerId.toString()
    );

    if (alreadyUsed) {
      logger.warn(`Coupon ${couponCode} already used by customer ${customerId}`);
      throw new Error("You have already used this coupon");
    }

    const applicableItems = cart.items.filter(
      (item) => item.shop._id.toString() === coupon.shop.toString()
    );

    if (applicableItems.length === 0) {
      throw new Error("This coupon is not applicable to items in your cart");
    }

    cart.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.code,
      shop: coupon.shop,
      discountType: coupon.discountType,
      discountValue: coupon.value,
      discountAmount: 0,
    };

    logger.info({
      event: "COUPON_APPLIED_TO_CART",
      customerId,
      couponCode,
      couponId: coupon._id,
      couponShop: coupon.shop.toString(),
      cartItemsShops: cart.items.map(item => ({
        productId: item.product._id || item.product,
        shopId: (item.shop?._id || item.shop).toString()
      })),
      applicableItemsCount: applicableItems.length
    });

    await this._recalculateCart(cart);
    await cart.save();

    logger.info({
      event: "COUPON_APPLIED_SUCCESS",
      customerId,
      couponCode,
      finalDiscount: cart.appliedCoupon?.discountAmount || 0,
      couponDiscount: cart.couponDiscount
    });

    // Re-populate after save to ensure fresh data
    await cart.populate("items.product items.shop");
    return cart;
  }

  async removeCoupon({ user }) {
    const customerId = user?._id || user?.id;

    if (!customerId) {
      throw new Error("Please login to remove coupon");
    }

    const cart = await Cart.findOne({ customer: customerId });
    if (!cart) {
      throw new Error("Cart not found");
    }

    cart.appliedCoupon = null;
    await this._recalculateCart(cart);
    await cart.save();

    logger.info(`Coupon removed from cart for customer ${customerId}`);
    
    // Re-populate after save to ensure fresh data
    await cart.populate("items.product items.shop");
    return cart;
  }


  async mergeGuestCart({ user, body }) {
    const { sessionId } = body;
    const customerId = user.id || user._id;

    const guestCart = await Cart.findOne({ sessionId });
    if (!guestCart) {
      logger.info("No guest cart to merge");
      return null;
    }

    
    if (guestCart.customer) {
      logger.info(`Cart ${guestCart._id} is already owned by a customer, skipping merge`);
      return null;
    }

    let customerCart = await Cart.findOne({ customer: customerId });
    if (!customerCart) {
      const customerModel = user?.role === 'student' ? 'Student' : 'Customer';
      customerCart = new Cart({ 
        customer: customerId, 
        customerModel,
        items: [] 
      });
    }

    const productIds = guestCart.items.map((i) => i.product);
    const products = await Product.find({
      _id: { $in: productIds },
      status: "active",
    });
    const activeIds = products.map((p) => p._id.toString());

    for (const item of guestCart.items) {
      if (!activeIds.includes(item.product.toString())) continue;

      const existingItem = customerCart.items.find(
        (i) => i.product.toString() === item.product.toString()
      );
      if (existingItem) existingItem.quantity += item.quantity;
      else {
        if (!item.shop) {
          const prod = await Product.findById(item.product).select("shop");
          item.shop = prod.shop;
        }
        customerCart.items.push(item);
      }
    }

    await this._recalculateCart(customerCart);
    await customerCart.save();
    await guestCart.deleteOne();

    try {
      await AbandonedCart.updateMany(
        { sessionId },
        { $set: { customer: customerId, sessionId: null } }
      );

      for (const item of customerCart.items) {
        await AbandonedCart.findOneAndUpdate(
          {
            customer: customerId,
            product: item.product,
            shop: item.shop,
          },
          {
            $set: {
              quantity: item.quantity,
              value: item.priceAtAddition * item.quantity,
              status: "pending",
              abandonedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }

      logger.info(`AbandonedCart entries merged for customer ${customerId}`);
    } catch (err) {
      logger.error("Error merging AbandonedCart entries: " + err.message);
    }

    return customerCart;
  }

  async clearCart({ user, body, query }) {
    const customerId = user?._id || user?.id || null;
    const sessionId = query?.sessionId || body?.sessionId || null;

    if (!sessionId && !customerId) {
      logger.error("Session ID or login required");
      throw new Error("Session ID or login required");
    }

    let cart;
    if (customerId) {
      cart = await Cart.findOne({ customer: customerId });
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId });
    }

    if (!cart) {
      logger.info(`Cart not found for clearCart request: ${customerId || sessionId}`);
      return null;
    }

    // Clear items and reset totals
    cart.items = [];
    cart.appliedCoupon = null;
    await this._recalculateCart(cart);
    await cart.save();

    // Clear abandoned cart entries
    try {
      const abandonedFilter = customerId
        ? { customer: customerId }
        : { sessionId };
      
      await AbandonedCart.deleteMany(abandonedFilter);
      logger.info(`AbandonedCart cleared for ${customerId || sessionId}`);
    } catch (err) {
      logger.error("Error clearing AbandonedCart: " + err.message);
    }

    logger.info(`Cart cleared for ${customerId || sessionId}`);
    return cart;
  }

  /**
   * FIXED ENTERPRISE CALCULATION:
   * 1. Base Price
   * 2. Product Discount
   * 3. BEST OF: Flash Sale OR Pricing Rule (not both stacked)
   * 4. Coupon (allocated proportionally across applicable items)
   * 5. Tax (calculated AFTER coupon on discounted price)
   * 6. Shipping (added separately)
   * 
   * @param {Object} cart - Cart document
   * @param {Object} opts - Options { addressId }
   */
async _recalculateCart(cart, opts = {}) {
  const startTime = Date.now();
  const addressId = opts.addressId || null;
  
  try {
    if (cart.items.length > 0 && !cart.items[0].product?.productName) {
      await cart.populate("items.product");
      await cart.populate("items.shop");
    }

    const customerId = cart.customer;

    // Guest cart: simple calculation
    if (!customerId) {
      logger.debug({
        event: "CART_RECALC_GUEST",
        itemCount: cart.items.length
      });

      let subtotal = 0;
      for (const item of cart.items) {
        const product = item.product;
        if (!product) continue;

        const price = product.priceWithTax || product.unitPrice;
        subtotal += price * item.quantity;
      }

      let shippingAmount = 0;
      let shippingBreakdown = [];
      if (cart.items.length > 0) {
        const shippingData = await shippingCalculator.calculateCartShipping(cart.items);
        shippingAmount = shippingData.totalShipping;
        shippingBreakdown = shippingData.shopShippingBreakdown;
      }

      cart.totalAmount = subtotal;
      cart.shippingAmount = shippingAmount;
      cart.shippingBreakdown = shippingBreakdown;
      cart.itemsWithTax = [];
      cart.couponDiscount = 0;

      logger.debug({
        event: "CART_RECALC_GUEST_COMPLETE",
        subtotal,
        shipping: shippingAmount,
        duration: `${Date.now() - startTime}ms`
      });

      return;
    }

    // Customer cart: enterprise calculation
    logger.debug({
      event: "CART_RECALC_CUSTOMER_START",
      customerId: customerId.toString(),
      itemCount: cart.items.length
    });

    const now = new Date();
    const productIds = cart.items.map(item => item.product._id || item.product);

    // Load flash sales
    const activeFlashSales = await FlashSale.find({
      products: { $in: productIds },
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).lean();

    const flashSaleMap = {};
    activeFlashSales.forEach(sale => {
      sale.products.forEach(productId => {
        const prodIdStr = productId.toString();
        if (!flashSaleMap[prodIdStr]) {
          flashSaleMap[prodIdStr] = sale;
        }
      });
    });

    // Load pricing rules
    const pricingRuleMap = await pricingRuleService.getApplicablePricingRules(
      cart.items,
      customerId
    );

    logger.debug({
      event: "FLASH_SALES_AND_PRICING_RULES_LOADED",
      customerId: customerId.toString(),
      activeFlashSalesCount: activeFlashSales.length,
      pricingRulesCount: Object.keys(pricingRuleMap).length
    });

    // Step 1: Build pre-tax, pre-coupon lines
    const lines = [];
    
    for (const item of cart.items) {
      const product = item.product;
      if (!product) {
        logger.warn({
          event: "CART_ITEM_NO_PRODUCT",
          itemId: item._id
        });
        continue;
      }

      const shopId = item.shop?._id?.toString() || item.shop?.toString();
      const originalPrice = product.unitPrice;
      let currentPrice = originalPrice;

      let productDiscountAmount = 0;
      let flashSaleDiscountAmount = 0;
      let pricingRuleDiscountAmount = 0;
      let upsellDiscountAmount = 0;
      let flashSaleInfo = null;
      let pricingRuleInfo = null;
      let upsellInfo = null;
      let bestCampaign = null;

      // Clean up empty subdocuments (Mongoose creates empty objects)
      if (item.upsellRuleApplied && !item.upsellRuleApplied.ruleId) {
        item.upsellRuleApplied = undefined;
      }
      if (item.crossSellRuleApplied && !item.crossSellRuleApplied.ruleId) {
        item.crossSellRuleApplied = undefined;
      }
      if (item.flashSaleSnapshot && !item.flashSaleSnapshot.flashSaleId) {
        item.flashSaleSnapshot = undefined;
      }

      const upsellRuleApplied =
        item.upsellRuleApplied && item.upsellRuleApplied.ruleId
          ? item.upsellRuleApplied
          : null;
      const crossSellRuleApplied =
        item.crossSellRuleApplied && item.crossSellRuleApplied.ruleId
          ? item.crossSellRuleApplied
          : null;
      const hasUpsell = !!(upsellRuleApplied || crossSellRuleApplied);
      
      if (hasUpsell) {
        const ruleApplied = upsellRuleApplied || crossSellRuleApplied;
        currentPrice = item.priceAtAddition;
        
        if (ruleApplied.discountType === "flat") {
          upsellDiscountAmount = ruleApplied.discountValue || 0;
        } else if (ruleApplied.discountType === "percentage") {
          upsellDiscountAmount = (originalPrice * (ruleApplied.discountValue || 0)) / 100;
        }

        upsellInfo = {
          ruleId: ruleApplied.ruleId,
          ruleName: ruleApplied.ruleName,
          discountType: ruleApplied.discountType,
          discountValue: ruleApplied.discountValue,
          discountAmount: upsellDiscountAmount,
          appliedAt: ruleApplied.appliedAt
        };

        productDiscountAmount = 0;
        flashSaleDiscountAmount = 0;
        pricingRuleDiscountAmount = 0;

      } else {
        // Step 1: Product Discount
        if (product.discountType === "flat") {
          productDiscountAmount = product.discountValue || 0;
          currentPrice = Math.max(0, currentPrice - productDiscountAmount);
        } else if (product.discountType === "percentage") {
          productDiscountAmount = (currentPrice * (product.discountValue || 0)) / 100;
          currentPrice = Math.max(0, currentPrice - productDiscountAmount);
        }

        const priceAfterProduct = currentPrice;

        // Step 2: BEST OF Flash Sale OR Pricing Rule
        let priceAfterFS = priceAfterProduct;
        let priceAfterPR = priceAfterProduct;

        // Calculate Flash Sale scenario
        const flashSale = flashSaleMap[product._id.toString()];
        const fsUsable = flashSale && flashSale.shop?.toString() === shopId;
        
        if (fsUsable) {
          if (flashSale.discountType === "flat") {
            flashSaleDiscountAmount = flashSale.discountValue;
          } else if (flashSale.discountType === "percentage") {
            flashSaleDiscountAmount = (priceAfterProduct * flashSale.discountValue) / 100;
          }
          priceAfterFS = Math.max(0, priceAfterProduct - flashSaleDiscountAmount);

          flashSaleInfo = {
            id: flashSale._id,
            name: flashSale.name,
            discountType: flashSale.discountType,
            discountValue: flashSale.discountValue,
            discountAmount: flashSaleDiscountAmount,
            endDate: flashSale.endDate,
          };

          logger.debug({
            event: "FLASH_SALE_APPLIED",
            productId: product._id,
            flashSaleId: flashSale._id,
            discountType: flashSale.discountType,
            discountValue: flashSale.discountValue,
            flashSaleDiscountAmount,
            priceAfterFS
          });
        } else {
          logger.debug({
            event: "FLASH_SALE_NOT_APPLICABLE",
            productId: product._id,
            flashSaleExists: !!flashSale,
            productShop: shopId,
            flashSaleShop: flashSale?.shop?.toString()
          });
        }

        // Calculate Pricing Rule scenario
        const pricingRule = pricingRuleMap[product._id.toString()];
        const prUsable = pricingRule && pricingRule.shop?.toString() === shopId;
        
        if (prUsable) {
          const ruleCalc = pricingRuleService.calculatePricingRuleDiscount(
            pricingRule,
            priceAfterProduct,
            item.quantity
          );

          pricingRuleDiscountAmount = ruleCalc.discountAmount;
          priceAfterPR = ruleCalc.priceAfterDiscount;

          pricingRuleInfo = {
            ruleId: pricingRule._id,
            ruleName: pricingRule.ruleName,
            discountType: pricingRule.discountType,
            discountValue: pricingRule.discountValue,
            discountAmount: pricingRuleDiscountAmount,
            customerGroup: pricingRule.customerGroup,
          };
        }

        // Choose best (lowest final price)
        if (fsUsable && prUsable) {
          if (priceAfterFS < priceAfterPR) {
            currentPrice = priceAfterFS;
            bestCampaign = "flashSale";
            pricingRuleDiscountAmount = 0;
            pricingRuleInfo = null;
          } else {
            currentPrice = priceAfterPR;
            bestCampaign = "pricingRule";
            flashSaleDiscountAmount = 0;
            flashSaleInfo = null;
          }
        } else if (fsUsable) {
          currentPrice = priceAfterFS;
          bestCampaign = "flashSale";
        } else if (prUsable) {
          currentPrice = priceAfterPR;
          bestCampaign = "pricingRule";
        }

        logger.debug({
          event: "BEST_CAMPAIGN_SELECTED",
          customerId: customerId.toString(),
          productId: product._id,
          bestCampaign,
          priceAfterFS,
          priceAfterPR,
          finalPrice: currentPrice
        });
      }

      // Get tax info
      const taxInfo = await taxService.getTaxRateForCustomer(shopId, customerId);
      const taxType = product.taxType || "exclusive";

      // Store line (pre-tax, pre-coupon)
      const preTaxUnit = currentPrice;
      const preTaxLine = preTaxUnit * item.quantity;

      lines.push({
        product,
        item,
        shopId,
        qty: item.quantity,
        originalPrice,
        productDiscountAmount,
        flashSaleDiscountAmount,
        pricingRuleDiscountAmount,
        upsellDiscountAmount,
        flashSaleInfo,
        pricingRuleInfo,
        upsellInfo,
        bestCampaign,
        hasUpsell,
        preTaxUnit,
        preTaxLine,
        taxRate: taxInfo.taxRate,
        taxType,
        region: taxInfo.region,
        couponLineDiscount: 0
      });
    }

    // Step 3: Apply Coupon BEFORE Tax (ALWAYS VALIDATE FROM DB)
    let couponDiscount = 0;
    let applicableSubtotalPreTax = 0;
    const applicableLineIdx = [];

    if (cart.appliedCoupon && cart.appliedCoupon.couponId) {
      const coupon = await Coupon.findById(cart.appliedCoupon.couponId).select('shop status startDate endDate discountType value');
      const now = new Date();

      logger.info({
        event: "COUPON_RECALC_START",
        couponId: cart.appliedCoupon.couponId,
        couponFound: !!coupon,
        couponStatus: coupon?.status,
        linesCount: lines.length
      });

      if (!coupon || coupon.status !== 'active' || now < coupon.startDate || now > coupon.endDate) {
        logger.warn({
          event: "COUPON_INVALID_DURING_RECALC",
          couponId: cart.appliedCoupon.couponId,
          reason: !coupon ? 'not_found' : coupon.status !== 'active' ? 'inactive' : 'expired'
        });
        cart.appliedCoupon = null;
        couponDiscount = 0;
      } else {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].shopId.toString() === coupon.shop.toString()) {
            applicableSubtotalPreTax += lines[i].preTaxLine;
            applicableLineIdx.push(i);
          }
        }

        logger.info({
          event: "COUPON_APPLICABLE_ITEMS_FOUND",
          couponShop: coupon.shop.toString(),
          applicableLineIdx,
          applicableSubtotalPreTax,
          discountType: coupon.discountType,
          discountValue: coupon.value
        });

        if (applicableSubtotalPreTax > 0) {
          if (coupon.discountType === "flat") {
            couponDiscount = Math.min(coupon.value, applicableSubtotalPreTax);
          } else if (coupon.discountType === "percentage") {
            couponDiscount = (applicableSubtotalPreTax * coupon.value) / 100;
          }
          
          logger.info({
            event: "COUPON_DISCOUNT_CALCULATED",
            couponDiscount,
            applicableSubtotalPreTax,
            discountType: coupon.discountType,
            discountValue: coupon.value
          });

          cart.appliedCoupon.shop = coupon.shop;
          cart.appliedCoupon.discountType = coupon.discountType;
          cart.appliedCoupon.discountValue = coupon.value;
          cart.appliedCoupon.discountAmount = couponDiscount;
        } else {
          logger.warn({
            event: "COUPON_NO_APPLICABLE_ITEMS",
            couponId: cart.appliedCoupon.couponId,
            couponShop: coupon.shop.toString(),
            linesShops: lines.map(l => l.shopId.toString())
          });
          cart.appliedCoupon = null;
          couponDiscount = 0;
        }
      }
    }

    // Allocate coupon proportionally
    let allocated = 0;
    for (let j = 0; j < applicableLineIdx.length; j++) {
      const i = applicableLineIdx[j];
      const isLast = j === applicableLineIdx.length - 1;
      let share = isLast
        ? (couponDiscount - allocated)
        : Math.round((lines[i].preTaxLine / applicableSubtotalPreTax) * couponDiscount * 100) / 100;
      allocated += share;
      lines[i].couponLineDiscount = Math.min(share, lines[i].preTaxLine);
    }

    // Step 4: Calculate Tax AFTER Coupon
    let subtotalExTaxAfterCoupon = 0;
    let totalTax = 0;
    const itemsWithTax = [];

    for (const L of lines) {
      const linePreTaxAfterCoupon = Math.max(0, L.preTaxLine - L.couponLineDiscount);
      const unitPreTaxAfterCoupon = L.qty > 0 ? linePreTaxAfterCoupon / L.qty : 0;

      const taxCalc = taxService.calculateTax(unitPreTaxAfterCoupon, L.taxRate, L.taxType);
      const unitWithTax = taxCalc.amountWithTax;
      const taxAmountUnit = taxCalc.taxAmount;
      const lineTax = taxAmountUnit * L.qty;
      const lineTotal = unitWithTax * L.qty;

      subtotalExTaxAfterCoupon += linePreTaxAfterCoupon;
      totalTax += lineTax;

      itemsWithTax.push({
        _id: L.product._id, // Add _id for React key
        productId: L.product._id,
        productName: L.product.productName,
        // Add full product object for frontend compatibility
        product: {
          _id: L.product._id,
          productName: L.product.productName,
          icon1: L.product.icon1,
          unitPrice: L.product.unitPrice,
        },
        quantity: L.qty,
        originalPrice: L.originalPrice,
        finalPriceWithTax: unitWithTax, // Add finalPriceWithTax field
        
        productDiscountType: L.hasUpsell ? "none" : (L.product.discountType || "none"),
        productDiscountValue: L.hasUpsell ? 0 : (L.product.discountValue || 0),
        productDiscount: L.productDiscountAmount,
        priceAfterProductDiscount: L.hasUpsell ? L.originalPrice : (L.originalPrice - L.productDiscountAmount),

        flashSale: L.bestCampaign === "flashSale" ? L.flashSaleInfo : null,
        flashSaleDiscount: L.flashSaleDiscountAmount,
        
        pricingRule: L.bestCampaign === "pricingRule" ? L.pricingRuleInfo : null,
        pricingRuleDiscount: L.pricingRuleDiscountAmount,
        
        upsellCrossSell: L.upsellInfo,
        upsellDiscount: L.upsellDiscountAmount,
        priceAfterUpsell: L.hasUpsell ? L.preTaxUnit : null,

        couponDiscount: L.couponLineDiscount,
        priceAfterCouponPreTax: unitPreTaxAfterCoupon,

        taxType: L.taxType,
        taxRate: L.taxRate,
        taxAmount: taxAmountUnit,
        basePrice: taxCalc.baseAmount,
        priceWithTax: unitWithTax,

        region: L.region,
        shopId: L.shopId,
        lineTotal
      });
    }

    // Step 5: Shipping
    let shippingAmount = 0;
    let shippingBreakdown = [];
    if (cart.items.length > 0) {
      const shippingData = await shippingCalculator.calculateCartShipping(cart.items);
      shippingAmount = shippingData.totalShipping || 0; // Ensure not NaN
      shippingBreakdown = shippingData.shopShippingBreakdown;
    }

    // Set totals
    cart.couponDiscount = couponDiscount || 0;
    cart.itemsWithTax = itemsWithTax;
    cart.shippingAmount = shippingAmount;
    cart.shippingBreakdown = shippingBreakdown;
    
    const calculatedTotal = subtotalExTaxAfterCoupon + totalTax;
    cart.totalAmount = !isNaN(calculatedTotal) ? Math.max(0, calculatedTotal) : 0;
    cart.grandTotal = !isNaN(cart.totalAmount + shippingAmount) ? (cart.totalAmount + shippingAmount) : 0;

    
    if (cart.grandTotal < 0) {
      logger.error({
        event: "CART_NEGATIVE_TOTAL",
        customerId: customerId.toString(),
        grandTotal: cart.grandTotal
      });
      throw new Error("Invalid cart total");
    }

    const duration = Date.now() - startTime;

    logger.debug({
      event: "CART_RECALC_COMPLETE",
      customerId: customerId.toString(),
      subtotalBeforeTax: subtotalExTaxAfterCoupon,
      couponDiscount,
      totalTax,
      totalAmount: cart.totalAmount,
      shipping: shippingAmount,
      grandTotal: cart.grandTotal,
      duration: `${duration}ms`
    });
  } catch (err) {
    logger.error({
      event: "CART_RECALC_ERROR",
      error: err.message,
      stack: err.stack,
      customerId: cart.customer?.toString(),
      duration: `${Date.now() - startTime}ms`
    });
    cart.calculateTotal();
  }
}

}

module.exports = new CartService();