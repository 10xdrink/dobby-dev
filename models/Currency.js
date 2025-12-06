const mongoose = require("mongoose")

const currencySchema = new mongoose.Schema({

    currencyName:{
        type:String,
        required:true
    },
    currencyCode:{
        type:String,
        required:true,
        
    },
    currencySymbol:{
        type:String,
        required:true,
        
    },
    exchangeRate:{
        type:String,
        required:true
    },
    isActive:{
        type:Boolean,
        default:false
    }

})

module.exports = mongoose.model("Currency",currencySchema)