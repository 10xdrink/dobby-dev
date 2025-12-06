const mongoose = require("mongoose");
const crypto = require("crypto");

const ENC_KEY = process.env.FEDEX_ENC_KEY; 
const IV = process.env.FEDEX_IV;           

function encryptText(plain) {
  const cipher = crypto.createCipheriv("aes-256-cbc",
    Buffer.from(ENC_KEY), Buffer.from(IV));
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return encrypted.toString("hex");
}

function decryptText(hex) {
  const buff = Buffer.from(hex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc",
    Buffer.from(ENC_KEY), Buffer.from(IV));
  const dec = Buffer.concat([decipher.update(buff), decipher.final()]);
  return dec.toString("utf8");
}

const fedexIntegrationSchema = new mongoose.Schema({
  shopkeeper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  clientId: { type: String, required: true },
  clientSecret: { type: String, required: true }, // encrypted
  accountNumber: { type: String, required: true },
  meterNumber: { type: String },
  pickupLocation: { type: String, required: true },
  pickupContactName: { type: String, required: true },
  pickupPhone: { type: String, required: true },
  pickupAddress: { type: String, required: true },
  pickupPincode: { type: String, required: true },
  pickupCity: { type: String, required: true },
  pickupState: { type: String, required: true },
  pickupCountry: { type: String, default: "IN" },
  useSandbox: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

fedexIntegrationSchema.pre("save", function(next) {
  if (!this.isModified("clientSecret")) return next();
  if (this.clientSecret) {
    this.clientSecret = encryptText(this.clientSecret);
  }
  next();
});

fedexIntegrationSchema.methods.getDecryptedSecret = function() {
  if (!this.clientSecret) return null;
  try {
    return decryptText(this.clientSecret);
  } catch (err) {
    return null;
  }
};

module.exports = mongoose.model("FedexIntegration", fedexIntegrationSchema);
