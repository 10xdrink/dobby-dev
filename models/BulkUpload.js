const mongoose = require("mongoose");

const bulkUploadSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    filePublicId: {
      type: String,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    processedRows: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "partial"],
      default: "pending",
    },
    errors: [
      {
        row: Number,
        field: String,
        message: String,
        data: mongoose.Schema.Types.Mixed,
      },
    ],
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    processingTime: {
      type: Number, // in seconds
    },
  },
  { timestamps: true }
);

bulkUploadSchema.index({ shop: 1, status: 1 });
bulkUploadSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model("BulkUpload", bulkUploadSchema);