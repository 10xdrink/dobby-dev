const mongoose = require("mongoose");
const crypto = require("crypto");

const ENC_KEY = process.env.UPS_ENC_KEY;
const IV = process.env.UPS_IV;

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

const upsIntegrationSchema = new mongoose.Schema({
  shopkeeper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  clientId: { type: String, required: true },
  clientSecret: { type: String, required: true },
  accountNumber: { type: String, required: true },
  pickupContactName: { type: String, required: true },
  pickupPhone: { type: String, required: true },
  pickupAddress: { type: String, required: true },
  pickupPincode: { type: String, required: true },
  pickupCity: { type: String, required: true },
  pickupState: { type: String, required: true },
  pickupCountry: { type: String, default: "IN" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

upsIntegrationSchema.pre("save", function (next) {
  if (!this.isModified("clientSecret")) return next();
  this.clientSecret = encryptText(this.clientSecret);
  next();
});

upsIntegrationSchema.methods.getDecryptedSecret = function () {
  if (!this.clientSecret) return null;
  try {
    return decryptText(this.clientSecret);
  } catch {
    return null;
  }
};

module.exports = mongoose.model("UpsIntegration", upsIntegrationSchema);
