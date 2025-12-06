const CookieSettings = require("../models/cookieSettings");

// Get current cookie settings
exports.getCookieSettings = async (req, res) => {
  try {
    const settings = await CookieSettings.getSetting();
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching cookie settings",
      error: error.message
    });
  }
};

// Update cookie settings (Admin only)
exports.updateCookieSettings = async (req, res) => {
  try {
    const { description, isActive } = req.body;
    const adminId = req.user.id; // from JWT middleware

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Description is required"
      });
    }

    let settings = await CookieSettings.findOne();
    
    if (!settings) {
      settings = new CookieSettings({
        description,
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: adminId
      });
    } else {
      settings.description = description;
      settings.isActive = isActive !== undefined ? isActive : settings.isActive;
      settings.updatedBy = adminId;
    }

    await settings.save();

    res.status(200).json({
      success: true,
      message: "Cookie settings updated successfully",
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating cookie settings",
      error: error.message
    });
  }
};

// Get cookie banner data 
exports.getCookieBanner = async (req, res) => {
  try {
    const settings = await CookieSettings.getSetting();
    
    // Only return description if isActive is true
    res.status(200).json({
      success: true,
      data: {
        description: settings.isActive ? settings.description : null,
        isActive: settings.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching cookie banner",
      error: error.message
    });
  }
};