const mongoose = require("mongoose")

const mapsettingsSchema = new mongoose.Schema({

    mapsEnabled: { type: Boolean, default: false },

  googleMapClientKey: { type: String, default: '' }, 
  googleMapServerKey: { type: String, default: '' },     

  updatedAt: { type: Date, default: Date.now }


})

module.exports = mongoose.model("Map", mapsettingsSchema);