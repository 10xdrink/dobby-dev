const UrlSettings = require("../models/UrlSettings")


exports.getUrl = async (req, res) => {
    try {
        let settings = await UrlSettings.findOne()
       if (!settings) {
      settings = await UrlSettings.create({});
    }
        res.status(200).json({
            loginUrl: settings.loginUrl,
            employeeLogin: settings.employeeLogin
        })

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


