const PaymentGateway = require("../models/PaymentGateway");
const PaymentSettings = require("../models/PaymentSettings");
const cloudinary = require("../config/cloudinary");

// Get all gateways
exports.getGateways = async (req, res) => {
  try {
    const gateways = await PaymentGateway.find();
    res.json(gateways);
  } catch (err) {
    res.status(500).json({ message: "Error fetching gateways", error: err });
  }
};

// Update or create gateway
// Update or create gateway
exports.updateGateway = async (req, res) => {
  try {
    const { name, credentials, isActive, title } = req.body;

    // Basic validation
    if (!name) {
      return res.status(400).json({ message: "Gateway name is required" });
    }

    if ((name === "razorpay" || name === "stripe") && (!credentials || !credentials.webhookSecret)) {
      return res.status(400).json({ message: `${name} requires webhookSecret` });
    }

    let gateway = await PaymentGateway.findOne({ name });

    if (!gateway) {
      gateway = new PaymentGateway({ name });
    }

    // Update credentials safely
    if (credentials) {
      for (let key of Object.keys(credentials)) {
        if (credentials[key] !== undefined && credentials[key] !== "") {
          gateway.credentials[key] = credentials[key]; 
        }
      }
    }

    // Update other fields
    if (typeof isActive !== "undefined") gateway.isActive = isActive;
    if (title) gateway.title = title;

    // If logo file uploaded
    if (req.file) {
      if (gateway.logoPublicId) {
        await cloudinary.uploader.destroy(gateway.logoPublicId);
      }
      gateway.logoUrl = req.file.path;
      gateway.logoPublicId = req.file.filename;
    }

    await gateway.save();

    res.json({ message: "Payment Gateway updated successfully", gateway });
  } catch (err) {
    res.status(500).json({ message: "Error updating gateway", error: err.message });
  }
};


// Get only active gateways (checking parent digitalPaymentEnabled toggle)
exports.getActiveGateways = async (req, res) => {
  try {
    // Get payment settings to check if digital payment is enabled
    const paymentSettings = await PaymentSettings.getSettings();
    
    // If digital payment is disabled, return empty array (no gateways should show)
    if (!paymentSettings.digitalPaymentEnabled) {
      return res.json([]);
    }
    
    // If digital payment is enabled, return only individually active gateways
    const gateways = await PaymentGateway.find({ isActive: true });
    res.json(gateways);
  } catch (err) {
    res.status(500).json({ message: "Error fetching active gateways", error: err });
  }
};

// Get payment settings (digital payment and COD toggles)
exports.getPaymentSettings = async (req, res) => {
  try {
    const settings = await PaymentSettings.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Error fetching payment settings", error: err });
  }
};

// Update payment settings (digital payment and COD toggles)
exports.updatePaymentSettings = async (req, res) => {
  try {
    const { digitalPaymentEnabled, cashOnDeliveryEnabled } = req.body;
    
    const settings = await PaymentSettings.getSettings();
    
    if (typeof digitalPaymentEnabled !== "undefined") {
      settings.digitalPaymentEnabled = digitalPaymentEnabled;
    }
    
    if (typeof cashOnDeliveryEnabled !== "undefined") {
      settings.cashOnDeliveryEnabled = cashOnDeliveryEnabled;
    }
    
    await settings.save();
    
    res.json({ message: "Payment settings updated successfully", settings });
  } catch (err) {
    res.status(500).json({ message: "Error updating payment settings", error: err.message });
  }
};
