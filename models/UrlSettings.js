const mongoose = require ("mongoose")

const urlsettingsSchema = new mongoose.Schema({

    loginUrl : {
        type:String,
        default:"https://test-dobby.vercel.app/Admin/"
    },
    employeeLogin : {
        type:String,
        default:"https://test-dobby.vercel.app/employee"

    }

})

module.exports = mongoose.model("UrlSettings", urlsettingsSchema)