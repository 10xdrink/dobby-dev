const mongoose = require("mongoose");

const upsAuthSchema = new mongoose.Schema({
  shopkeeper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  token: { type: String },
  tokenExpiry: { type: Date },
  webhookCreated: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("UpsAuth", upsAuthSchema);
