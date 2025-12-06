const mongoose = require("mongoose");
const crypto = require("crypto");

const ENC_KEY = process.env.SHIPROCKET_SECRET; // must be 32 chars
const IV = process.env.SHIPROCKET_IV; // must be 16 chars

function encryptText(plain) {
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENC_KEY), Buffer.from(IV));
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return encrypted.toString("hex");
}

function decryptText(hex) {
  const buff = Buffer.from(hex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENC_KEY), Buffer.from(IV));
  const dec = Buffer.concat([decipher.update(buff), decipher.final()]);
  return dec.toString("utf8");
}

const shiprocketIntegrationSchema = new mongoose.Schema(
  {
    shopkeeper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    shiprocketEmail: { type: String, required: true },
    shiprocketPassword: { type: String, required: true },
    pickupLocation: { type: String, required: true },
    pickupContactName: { type: String, required: true },
    pickupPhone: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    pickupPincode: { type: String, required: true },
    pickupCity: { type: String, required: true },
    pickupState: { type: String, required: true },
    pickupCountry: { type: String, default: "India" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Normalize email
shiprocketIntegrationSchema.pre("save", function (next) {
  if (this.shiprocketEmail) {
    this.shiprocketEmail = this.shiprocketEmail.trim().toLowerCase();
  }
  next();
});

// Encrypt password before saving
shiprocketIntegrationSchema.pre("save", function (next) {
  if (!this.isModified("shiprocketPassword")) return next();
  if (this.shiprocketPassword) {
    this.shiprocketPassword = encryptText(this.shiprocketPassword);
  }
  next();
});

// Decrypt helper method
shiprocketIntegrationSchema.methods.getDecryptedPassword = function () {
  if (!this.shiprocketPassword) return null;
  try {
    return decryptText(this.shiprocketPassword);
  } catch (err) {
    return null;
  }
};

module.exports = mongoose.model("ShiprocketIntegration", shiprocketIntegrationSchema);
