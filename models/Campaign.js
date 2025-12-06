const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema({
  campaignName: { type: String, required: true },
  emailSubject: { type: String, required: true },
  emailContent: { type: String, required: true },
  emailTemplate: { type: String },
  discountCode: { type: String },
  recipientGroup: { type: String, default: "All Subscribers" },
  sendDate: { type: Date },
  status: { type: String, enum: ["scheduled", "sent"], default: "scheduled" },
  mailchimpCampaignId: { type: String },
  sentCount: { type: Number, default: 0 },
  emailsSent: { type: Number, default: 0 },
  openRate: { type: Number, default: 0 },
  clickRate: { type: Number, default: 0 },
  lastSentAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Campaign", campaignSchema);
