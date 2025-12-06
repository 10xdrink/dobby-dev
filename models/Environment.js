const mongoose = require("mongoose")

const environmentsettingsSchema = new mongoose.Schema({
    appName:{
        type:String,
        default:"DOBBY MALL"
    },
    appDebug:{
        type:Boolean,
        default:false
    },
    appMode:{
        type:String,
        enum:["dev","live"],
        default:"dev"
    },
    appUrl:{
        type:String,
        default:"https://test-dobby.vercel.app/"
    },
    dbConnection:{
        type:String,
        default:"mongodb"
    },
    dbHost:{
        type:String,
        default:"cluster0.4xyfpuq.mongodb.net"
    },
    dbPort:{
        type:Number,
        default:27017
    },
    dbDatabase:{
        type:String,
        default:"dobbymall"
    },
    dbUsername:{
        type:String,
        default:"digitalmongers72"
    },
    dbPassword:{
        type:String,
        default:"0PDl1xgznRc7Z855"
    }
})

module.exports = mongoose.model("EnvironmentSettings",environmentsettingsSchema)