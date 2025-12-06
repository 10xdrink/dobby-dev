// models/ReturnRequest.js
const mongoose = require('mongoose');

const returnRequestSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'customerModel',
    required: true
  },
  customerModel: {
    type: String,
    enum: ['Customer', 'Student'],
    default: 'Customer',
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  
  reason: {
    type: String,
    enum: ['damaged', 'defective', 'better_price', 'not_perfect'],
    required: true
  },
  
  queryType: {
    type: String,
    enum: ['replacement', 'refund'],
    required: true
  },
  
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  amount: {
    type: Number,
    required: true
  },
  
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  
  status: {
    type: String,
    enum: ['processing', 'completed', 'rejected'],
    default: 'processing'
  },
  
  shopkeeperComment: {
    type: String,
    default: null
  },
  
  processedAt: {
    type: Date,
    default: null
  },
  
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
  
}, { timestamps: true });

// Indexes
returnRequestSchema.index({ shop: 1, status: 1, createdAt: -1 });
returnRequestSchema.index({ customer: 1, createdAt: -1 });
returnRequestSchema.index({ order: 1, product: 1, status: 1 });

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);