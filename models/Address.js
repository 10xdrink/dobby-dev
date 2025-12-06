const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "customerModel",
    },
    customerModel: {
      type: String,
      enum: ["Customer", "Student"],
      default: "Customer",
    },
    sessionId: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String },
    email: { type: String },
    phone: { type: String, required: true },
    addressLine: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String },
    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ["shipping", "billing"],
      default: "shipping",
    },
  },
  { timestamps: true }
);

addressSchema.index({ customer: 1, isDefault: -1 });
addressSchema.index({ sessionId: 1 });
addressSchema.index({
  customer: 1,
  addressLine: 1,
  zipCode: 1,
  city: 1,
  state: 1,
  country: 1,
  isDeleted: 1,
});

addressSchema.index(
  { customer: 1, type: 1, isDefault: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      isDefault: true,
      customer: { $ne: null }
    } 
  }
);

// Separate unique index for guest users using sessionId
addressSchema.index(
  { sessionId: 1, type: 1, isDefault: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      isDefault: true,
      sessionId: { $ne: null }
    } 
  }
);

addressSchema.pre(/^find/, function (next) {
  if (!this.getFilter().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model("Address", addressSchema);
