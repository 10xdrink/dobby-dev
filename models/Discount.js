const mongoose = require('mongoose');
const { Schema } = mongoose;

const DiscountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    usageLimit: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    minPurchaseAmount: { type: Number, default: null, min: 0 },
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

DiscountSchema.pre('validate', function (next) {
  if (this.type === 'percentage' && (this.value < 0 || this.value > 100)) {
    return next(new Error('Percentage discounts must be between 0 and 100.'));
  }
  if (this.endDate < this.startDate) {
    return next(new Error('End Date must be after Start Date.'));
  }
  next();
});

DiscountSchema.virtual('isActive').get(function () {
  const now = new Date();
  const within = now >= this.startDate && now <= this.endDate;
  const underLimit = this.usageLimit == null || this.usedCount < this.usageLimit;
  return !this.isDeleted && within && underLimit;
});

module.exports = mongoose.model('Discount', DiscountSchema);
