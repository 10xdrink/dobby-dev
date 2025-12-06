const mongoose = require("mongoose");
const Cart = require("./Cart");
const CustomerGroup = require("./CustomerGroup");
const logger = require("../config/logger");
const Address = require("./Address");
const Wishlist = require("./Wishlist");
const Order = require("./Order");
const Review = require("./Review");
const RefundMethod = require("./RefundMethod");

const customerSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: {
      type: String,
      required: function () {
        return !this.phone;
      },
      match: [
        /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
        "Please enter a valid email address",
      ],
      unique: true,
      sparse: true,
    },

    role: { type: String, enum: ["customer"], default: "customer" },

    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    password: String,
    birthday: { type: Date, default: null },
    authProvider: {
      type: String,
      enum: ["local", "google", "facebook", "apple", "amazon"],
      default: "local",
    },

    profilePhoto: { type: String, default: null },
    profilePhotoId: { type: String, default: null },

    loginAttempts: { type: Number, default: 0 },
    loginBlockUntil: { type: Date, default: null },

    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customerSchema.set("toObject", { virtuals: true });
customerSchema.set("toJSON", { virtuals: true });

customerSchema.virtual("cart", {
  ref: "Cart",
  localField: "_id",
  foreignField: "customer",
  justOne: true,
});

customerSchema.virtual("addresses", {
  ref: "Address",
  localField: "_id",
  foreignField: "customer",
});

customerSchema.virtual("wishlist", {
  ref: "Wishlist",
  localField: "_id",
  foreignField: "customer",
  justOne: true,
});

customerSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      logger.info(`Deleting all data for customer: ${this._id}`);
      
      // Delete all customer-related data
      await Cart.deleteMany({ customer: this._id });
      await Address.deleteMany({ customer: this._id });
      await Wishlist.deleteMany({ customer: this._id });
      await CustomerGroup.deleteMany({ customer: this._id });
      await Order.deleteMany({ customer: this._id });
      await Review.deleteMany({ customer: this._id });
      await RefundMethod.deleteMany({ customer: this._id });
      
      logger.info(`All data deleted for customer: ${this._id}`);
      next();
    } catch (err) {
      logger.error(`Error deleting customer data: ${err.message}`);
      next(err);
    }
  }
);

customerSchema.post("save", async function (doc) {
  try {
    
    const existingGroup = await CustomerGroup.findOne({ customer: doc._id });

    if (!existingGroup) {
      await CustomerGroup.create({
        customer: doc._id,
        currentGroup: "retail",
        groups: ["retail"],
        metrics: {
          totalOrders: 0,
          totalSpent: 0,
          avgOrderValue: 0,
          highestOrderValue: 0,
          last30DaysOrders: 0,
          last30DaysSpent: 0,
          accountAgeMonths: 0,
        },
        lastEvaluatedAt: new Date(),
      });


      logger.info({
        event: "CUSTOMER_GROUP_AUTO_CREATED",
        customerId: doc._id,
        group: "retail",
      });
    }
  } catch (err) {
    const logger = require("../config/logger");
    logger.error({
      event: "CUSTOMER_GROUP_AUTO_CREATE_ERROR",
      customerId: doc._id,
      error: err.message,
    });
  }
});

module.exports = mongoose.model("Customer", customerSchema);
