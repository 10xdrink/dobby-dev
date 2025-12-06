const mongoose = require("mongoose");

const oAuthProviderSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["google", "facebook", "apple", "amazon"],
      required: true,
      unique: true,
    },
    clientId: { type: String, required: true },
    clientSecret: { type: String, required: true },
    callbackURL: { type: String, required: true },
    isActive: { type: Boolean, default: false },

    teamId: { type: String }, 
    keyId: { type: String }, 

  },
  { timestamps: true }
);

module.exports = mongoose.model("OAuthProvider", oAuthProviderSchema);
