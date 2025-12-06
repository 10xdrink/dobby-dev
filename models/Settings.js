/*  const mongoose = require("mongoose");
const crypto = require("crypto");

const MASTER_KEY = Buffer.from(process.env.MASTER_KEY, "hex");

function encrypt(text) {
  if (!text) return undefined;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", MASTER_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: iv.toString("hex"), data: encrypted };
}

function decrypt(encryptedObj) {
  if (!encryptedObj || !encryptedObj.iv || !encryptedObj.data) return "";
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    MASTER_KEY,
    Buffer.from(encryptedObj.iv, "hex")
  );
  let decrypted = decipher.update(encryptedObj.data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const settingSchema = new mongoose.Schema({
  
  googleClientId: { iv: String, data: String },
  googleClientSecret: { iv: String, data: String },
  googleCallbackURL: String,
  googleIsActive: { type: Boolean, default: false },

  
  facebookAppId: { iv: String, data: String },
  facebookAppSecret: { iv: String, data: String },
  facebookCallbackURL: String,
  facebookIsActive: { type: Boolean, default: false },

  // 🔹 Amazon
  amazonClientId: { iv: String, data: String },
  amazonClientSecret: { iv: String, data: String },
  amazonCallbackURL: String,
  amazonIsActive: { type: Boolean, default: false },
});


settingSchema.methods.getDecrypted = function () {
  return {
    googleClientId: this.googleClientId ? decrypt(this.googleClientId) : "",
    googleClientSecret: this.googleClientSecret
      ? decrypt(this.googleClientSecret)
      : "",
    googleCallbackURL: this.googleCallbackURL,
    googleIsActive: this.googleIsActive,

    facebookAppId: this.facebookAppId ? decrypt(this.facebookAppId) : "",
    facebookAppSecret: this.facebookAppSecret
      ? decrypt(this.facebookAppSecret)
      : "",
    facebookCallbackURL: this.facebookCallbackURL,
    facebookIsActive: this.facebookIsActive,

    amazonClientId: this.amazonClientId ? decrypt(this.amazonClientId) : "",
    amazonClientSecret: this.amazonClientSecret
      ? decrypt(this.amazonClientSecret)
      : "",
    amazonCallbackURL: this.amazonCallbackURL,
    amazonIsActive: this.amazonIsActive,
  };
};


settingSchema.statics.encryptFields = function (data) {
  return {
    googleClientId: data.googleClientId
      ? encrypt(data.googleClientId)
      : undefined,
    googleClientSecret: data.googleClientSecret
      ? encrypt(data.googleClientSecret)
      : undefined,
    googleCallbackURL: data.googleCallbackURL,
    googleIsActive: data.googleIsActive,

    facebookAppId: data.facebookAppId ? encrypt(data.facebookAppId) : undefined,
    facebookAppSecret: data.facebookAppSecret
      ? encrypt(data.facebookAppSecret)
      : undefined,
    facebookCallbackURL: data.facebookCallbackURL,
    facebookIsActive: data.facebookIsActive,

    amazonClientId: data.amazonClientId ? encrypt(data.amazonClientId) : undefined,
    amazonClientSecret: data.amazonClientSecret
      ? encrypt(data.amazonClientSecret)
      : undefined,
    amazonCallbackURL: data.amazonCallbackURL,
    amazonIsActive: data.amazonIsActive,
  };
};

module.exports = mongoose.model("Setting", settingSchema); */
