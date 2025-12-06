const Customer = require("../models/Customer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const PasswordResetToken = require("../models/PasswordResetToken");
const {
  generatePasswordResetEmail,
  generatePasswordResetSuccessEmail,
} = require("../utils/emailTemplates");

const Review = require("../models/Review");
const Product = require("../models/productModel");
const jwt = require("jsonwebtoken");
const { sendSMS } = require("../utils/sms");

const cloudinary = require("../config/cloudinary");
const verifyCaptcha = require("../utils/verifyCaptcha");

const OTP = require("../models/OTPModel");
const OtpSettings = require("../models/OtpSettings");

const CustomerMailTemplate = require("../models/CustomerMailTemplate");
const { sendOTP, sendEmail } = require("../utils/mailer");
const logger = require("../config/logger");
const BlacklistedToken = require("../models/BlacklistedToken");
const { createAndEmitNotification } = require("../helpers/notification");

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES) || 5;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 3;

exports.generateToken = function (customer) {
  return jwt.sign(
    {
      _id: customer._id,
      email: customer.email,
      role: customer.role || "customer",
      tokenVersion: customer.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendCustomerTemplateMail(to, type, placeholders = {}) {
  const template = await CustomerMailTemplate.findOne({ templateType: type });
  if (!template || !template.isActive) {
    console.log(`Customer Template not found or inactive: ${type}`);
    return;
  }

  let mailBody = template.mailBody;
  for (const [key, value] of Object.entries(placeholders)) {
    mailBody = mailBody.replace(new RegExp(`{${key}}`, "g"), value);
  }

  // Page links
  let pageLinksHtml = "";
  for (const [key, value] of Object.entries(template.pageLinks || {})) {
    if (value.enabled) {
      pageLinksHtml += `<a href="${
        value.url
      }" style="margin:0 8px; color:#000; text-decoration:none; text-transform:capitalize;">
  ${key.replace(/([A-Z])/g, " $1")}
</a>`;
    }
  }
  const iconMap = {
    facebook:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/facebook-black.png",
    instagram:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/instagram-black.png",
    x: "https://res.cloudinary.com/demo/image/upload/v1729600000/x-black.png",
    linkedin:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/linkedin-black.png",
    youtube:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/youtube-black.png",
  };

  let socialLinksHtml = "";
  for (const [key, value] of Object.entries(template.socialMediaLinks || {})) {
    if (value.enabled && value.url) {
      const iconUrl =
        iconMap[key.toLowerCase()] ||
        "https://res.cloudinary.com/demo/image/upload/v1729600000/link-black.png";
      socialLinksHtml += `
      <a href="${value.url}" style="margin:0 5px;" target="_blank">
        <img src="${iconUrl}" alt="${key}" height="22" style="vertical-align:middle; display:inline-block;"/>
      </a>
    `;
    }
  }

  const htmlContent = `
 <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px; background:#fff; border:1px solid #e0e0e0; border-radius:8px;">
    <div style="text-align:center; margin-bottom:20px;">
      <img src="${
        template.logoUrl
      }" alt="Logo" style="width:100px; height:100px; object-fit:contain; border-radius:8px;"/>
    </div>
      <h2 style="color:#333;">${template.title}</h2>
      <p style="color:#555; font-size:15px; line-height:1.6;">${mailBody}</p>
      <p style="color:#555; font-size:14px; line-height:1.6;">
        ${template.footerSectionText || ""}
      </p>
      <div style="text-align:center; margin-bottom:20px;">
        <img src="${template.iconUrl}" alt="Icon" style="height:60px;"/>
      </div>
      <div style="margin-top:20px; text-align:center;">${pageLinksHtml}</div>
      <div style="margin-top:20px; text-align:center;">${socialLinksHtml}</div>
      <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;"/>
      <p style="font-size:12px; color:#888; text-align:center;">
        ${template.copyrightText || ""}
      </p>
    </div>
  `;

  await sendEmail(to, template.title, htmlContent);
}

const CUSTOMER_OTP_CONTEXT = {
  FORGOT_PASSWORD: "customer_forgot_password",
};

const normalizeEmailIdentifier = (email = "") => email.trim().toLowerCase();

function normalizePhoneIdentifier(phone = "") {
  if (!phone) return undefined;
  let value = phone.trim().replace(/\s+/g, "");

  if (!value) return undefined;

  if (value.startsWith("+")) {
    return value;
  }

  if (value.startsWith("0") && value.length === 11) {
    value = value.substring(1);
  }

  if (/^\d{10}$/.test(value)) {
    return `+91${value}`;
  }

  if (/^91\d{10}$/.test(value)) {
    return `+${value}`;
  }

  return undefined;
}

function resolveIdentifier(identifier) {
  if (!identifier) {
    return {
      type: null,
      normalizedEmail: undefined,
      normalizedPhone: undefined,
    };
  }

  const trimmed = identifier.trim();

  if (trimmed.includes("@")) {
    return {
      type: "email",
      normalizedEmail: normalizeEmailIdentifier(trimmed),
      normalizedPhone: undefined,
    };
  }

  const normalizedPhone = normalizePhoneIdentifier(trimmed);
  return {
    type: normalizedPhone ? "phone" : null,
    normalizedEmail: undefined,
    normalizedPhone,
  };
}

const buildIdentifierFilter = ({ normalizedEmail, normalizedPhone }) =>
  normalizedEmail ? { email: normalizedEmail } : { phone: normalizedPhone };

function buildOrFilterDefined({ email, phone }) {
  const or = [];
  if (email) or.push({ email });
  if (phone) or.push({ phone });
  return or.length ? { $or: or } : {};
}

async function deleteFromCloudinary(url) {
  if (!url) return;
  try {
    const publicId = url.split("/").slice(-2).join("/").split(".")[0];
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

function normalizeKey(email, phone) {
  if (email) return email.trim().toLowerCase();
  if (phone) {
    let p = phone.trim();
    if (!p.startsWith("+")) p = "+91" + p;
    return p;
  }
  return null;
}

// Send OTP (Signup - no captcha)

exports.sendSignupOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      logger.warn("Signup OTP request missing both email and phone");
      return res.status(400).json({
        success: false,
        message: "Email or phone number is required",
      });
    }

    const normEmail = email ? normalizeEmailIdentifier(email) : undefined;
    const normPhone = phone ? normalizePhoneIdentifier(phone) : undefined;

    logger.info(`Signup OTP requested for ${normEmail || normPhone}`);

    const settings = (await OtpSettings.findOne()) || {};
    const otpExpirySec = settings.otpExpiryTime || 120;
    const tempBlockSec = settings.tempOtpBlockTime || 300;

    // Check existing OTP block
    let otpDoc = await OTP.findOne({
      ...buildOrFilterDefined({ email: normEmail, phone: normPhone }),
      context: "customer_signup",
    });

    if (!otpDoc) {
      otpDoc = new OTP({
        email: normEmail,
        phone: normPhone,
        context: "customer_signup",
      });
    }

    if (otpDoc.blockUntil && otpDoc.blockUntil > Date.now()) {
      const mins = Math.ceil((otpDoc.blockUntil - Date.now()) / 60000);
      logger.warn(`Signup OTP temporarily blocked for ${normEmail || normPhone}`);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} min`,
      });
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne(
      buildOrFilterDefined({ email: normEmail, phone: normPhone })
    );
    if (existingCustomer) {
      logger.warn(`Signup attempt for existing customer: ${normEmail || normPhone}`);
      return res.status(400).json({
        success: false,
        message: "Email or phone already in use",
      });
    }

    // Generate and assign OTP
    const otp = generateOtp();
    otpDoc.otp = otp;
    otpDoc.otpExpiry = new Date(Date.now() + otpExpirySec * 1000);
    otpDoc.attempts = 0;
    otpDoc.createdAt = Date.now();
    await otpDoc.save();

    // Send OTP
    if (normEmail) {
      await sendOTP(normEmail, otp);
      logger.info(`Signup OTP sent via email to ${normEmail}`);
      await sendCustomerTemplateMail(normEmail, "registration_verification", {
        Name: normEmail.split("@")[0],
        OTP: otp,
      });
    }

    if (normPhone) {
      await sendSMS(normPhone, otp);
      logger.info(`Signup OTP sent via SMS to ${normPhone}`);
    }

    return res.json({ success: true, message: "OTP sent successfully", otpExpiry: otpDoc.otpExpiry,  });
  } catch (err) {
    logger.error("sendSignupOtp error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifySignupOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      logger.warn("Verify Signup OTP called without OTP");
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    const settings = (await OtpSettings.findOne()) || {};
    const maxAttempts = settings.maxOtpAttempts || 3;
    const tempBlockSec = settings.tempOtpBlockTime || 21600;

    // Find by OTP with context scoping
    const otpDoc = await OTP.findOne({
      otp,
      context: "customer_signup",
      otpExpiry: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      logger.warn(`Invalid or expired OTP entered: ${otp}`);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Block check
    if (otpDoc.blockUntil && otpDoc.blockUntil > Date.now()) {
      const mins = Math.ceil((otpDoc.blockUntil - Date.now()) / 60000);
      logger.warn(`Signup OTP blocked for ${otpDoc.email || otpDoc.phone}`);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} min`,
      });
    }

    // Attempt check
    if (otpDoc.attempts >= maxAttempts) {
      otpDoc.blockUntil = new Date(Date.now() + tempBlockSec * 1000);
      await otpDoc.save();
      logger.warn(`Max OTP attempts exceeded for ${otpDoc.email || otpDoc.phone}`);
      return res.status(429).json({
        success: false,
        message: "Max OTP attempts exceeded. Try later.",
      });
    }

    // OTP Verified → Delete record
    await OTP.deleteOne({ _id: otpDoc._id });

    // Find or create customer by email or phone
    let customer = await Customer.findOne(
      buildOrFilterDefined({ email: otpDoc.email, phone: otpDoc.phone })
    );

    // If customer doesn't exist, create now
    if (!customer) {
      customer = new Customer({ email: otpDoc.email, phone: otpDoc.phone });
      await customer.save();
      logger.info(
        `Customer created after OTP verification: ${
          customer.email || customer.phone
        }`
      );
    }

    logger.info(`Signup OTP verified for ${otpDoc.email || otpDoc.phone}`);

    return res.json({
      success: true,
      message: "OTP verified. Complete your profile.",
      email: customer.email || "",
      phone: customer.phone || "",
    });
  } catch (err) {
    logger.error("verifySignupOtp error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// STEP 3: Complete Profile
exports.completeSignup = async (req, res) => {
  try {
    const { email, firstName, lastName, phone, password } = req.body;

    const normEmail = email ? normalizeEmailIdentifier(email) : undefined;
    const normPhone = phone ? normalizePhoneIdentifier(phone) : undefined;

    logger.info(`Signup completion attempt for ${normEmail || normPhone}`);

    const customer = await Customer.findOne(
      buildOrFilterDefined({ email: normEmail, phone: normPhone })
    );

    if (!customer) {
      logger.warn(
        `Signup completion failed - customer not found: ${normEmail || normPhone}`
      );
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    customer.firstName = firstName;
    customer.lastName = lastName;
    if (normPhone) customer.phone = normPhone; // Always update phone if provided
    if (normEmail && !customer.email) customer.email = normEmail;

    if (password) {
      customer.password = await bcrypt.hash(password, 10);
    }

    await customer.save();
    logger.info(`Signup completed successfully for ${customer.email || customer.phone}`);

    // Send notification to admin about new customer registration
    try {
      const customerName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email || customer.phone || "Customer";
      await createAndEmitNotification({
        title: "New Customer Registration",
        message: `${customerName} has registered as a new customer`,
        event: "CUSTOMER_REGISTERED",
        targetModels: ["Admin"],
        meta: {
          customerId: customer._id,
          customerName: customerName,
          email: customer.email,
          phone: customer.phone,
          registeredAt: customer.createdAt || new Date(),
        },
      });
      logger.info(`Notification sent to admin for new customer registration: ${customer._id}`);
    } catch (notifErr) {
      logger.error(`Failed to send registration notification: ${notifErr.message}`);
      // Don't fail signup if notification fails
    }

    const token = exports.generateToken(customer);

    res.json({
      success: true,
      message: "Signup completed",
      token,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (err) {
    logger.error("completeSignup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

function formatPhone(phone) {
  if (!phone) return null;
  if (phone.startsWith("+")) return phone;
  return "+91" + phone;
}

exports.sendLoginOtp = async (req, res) => {
  try {
    let { email, phone, password } = req.body;

    const normEmail = email ? normalizeEmailIdentifier(email) : undefined;
    const normPhone = phone ? normalizePhoneIdentifier(phone) : undefined;

    logger.info(`Login OTP request received for ${normEmail || normPhone}`);

    if (!normEmail && !normPhone) {
      logger.warn("Login OTP request missing both email and phone");
      return res.status(400).json({
        success: false,
        message: "Email or phone is required",
      });
    }

    // Find or create customer by email or phone (for OTP-only flow)
    let customer = await Customer.findOne(
      buildOrFilterDefined({ email: normEmail, phone: normPhone })
    );

    // If customer doesn't exist, create a minimal record for OTP verification
    if (!customer) {
      logger.info(`Creating new customer record for OTP login: ${normEmail || normPhone}`);
      customer = new Customer({
        email: normEmail,
        phone: normPhone,
      });
      await customer.save();
    }

    // Check if customer is blocked
    if (customer.isBlocked || customer.blocked) {
      logger.warn(`Blocked customer attempted login: ${normEmail || normPhone}`);
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    // Verify password only if provided and not the placeholder
    if (password && password !== 'OTP_AUTH' && password !== 'OTP_AUTH_MODE') {
      if (!customer.password) {
        logger.warn(`Password provided but customer has no password set: ${normEmail || normPhone}`);
        return res.status(400).json({
          success: false,
          message: "No password set for this account. Use OTP-only login.",
        });
      }

      const passwordMatches = await bcrypt.compare(password, customer.password);
      if (!passwordMatches) {
        logger.warn(`Invalid password for ${normEmail || normPhone}`);
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }
    }

    // Proceed with OTP logic (password check passed or skipped)
    const settings = (await OtpSettings.findOne()) || {};
    const resendWait = settings.otpResendTime || 60;
    const tempBlockSec = settings.tempLoginBlockTime || 21600;
    const otpExpiryTime = settings.otpExpiryTime || 120;

    // Check for existing OTP doc
    let otpDoc = await OTP.findOne({
      ...buildOrFilterDefined({ email: normEmail, phone: normPhone }),
      context: "customer_login",
    });

    if (otpDoc?.blockUntil && otpDoc.blockUntil > Date.now()) {
      const mins = Math.ceil((otpDoc.blockUntil - Date.now()) / 60000);
      logger.warn(`Login OTP temporarily blocked for ${normEmail || normPhone}`);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} min`,
      });
    }

    // Resend wait check
    if (
      otpDoc?.createdAt &&
      Date.now() - otpDoc.createdAt.getTime() < resendWait * 1000
    ) {
      const secs = Math.ceil(
        (resendWait * 1000 - (Date.now() - otpDoc.createdAt.getTime())) / 1000
      );
      logger.warn(
        `Login OTP resend blocked for ${normEmail || normPhone} - wait ${secs}s`
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${secs}s before requesting a new OTP`,
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + otpExpiryTime * 1000);

    if (!otpDoc) {
      otpDoc = new OTP({
        email: normEmail,
        phone: normPhone,
        otp,
        otpExpiry,
        attempts: 0,
        context: "customer_login",
        createdAt: new Date(),
        lastSentAt: new Date(),
      });
    } else {
      otpDoc.otp = otp;
      otpDoc.otpExpiry = otpExpiry;
      otpDoc.attempts = 0;
      otpDoc.createdAt = new Date();
      otpDoc.blockUntil = null;
      otpDoc.lastSentAt = new Date();
    }

    await otpDoc.save();

    // Send OTP
    if (normEmail) {
      await sendOTP(normEmail, otp);
      logger.info(`Login OTP sent to email: ${normEmail}`);
    }

    if (normPhone) {
      await sendSMS(normPhone, otp);
      logger.info(`Login OTP sent to phone: ${normPhone}`);
    }

    return res.json({ success: true, message: "OTP sent successfully",otpExpiry: otpExpiry });
  } catch (err) {
    logger.error("sendLoginOtp error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      logger.warn("verifyLoginOtp called without OTP");
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }
    // Load OTP settings
    const settings = (await OtpSettings.findOne()) || {};
    const maxLoginAttempts = settings.maxLoginAttempts || 3;
    const tempLoginBlockTime = settings.tempLoginBlockTime || 21600; // seconds

    // Find OTP document by otp with context scoping
    const otpDoc = await OTP.findOne({
      otp,
      context: "customer_login",
      otpExpiry: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      logger.warn(`Invalid OTP attempt: ${otp}`);
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }
    // Temporary block check
    if (otpDoc.blockUntil && otpDoc.blockUntil > Date.now()) {
      const mins = Math.ceil((otpDoc.blockUntil - Date.now()) / 60000);
      logger.warn(
        `OTP temporarily blocked for ${otpDoc.email || otpDoc.phone}`
      );
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} min`,
      });
    }

    // Expiry check
    if (!otpDoc.otp || Date.now() > otpDoc.otpExpiry) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Max attempts check
    if (otpDoc.attempts >= maxLoginAttempts) {
      otpDoc.blockUntil = new Date(Date.now() + tempLoginBlockTime * 1000);
      await otpDoc.save();
      logger.warn(
        `Max OTP attempts exceeded for ${otpDoc.email || otpDoc.phone}`
      );
      return res.status(429).json({
        success: false,
        message: "Max OTP attempts exceeded. Try later.",
      });
    }

    // OTP match check (double check)
    if (otp !== otpDoc.otp) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      logger.warn(`Incorrect OTP entered for ${otpDoc.email || otpDoc.phone}`);
      return res.status(400).json({ success: false, message: "Incorrect OTP" });
    }

    // Cleanup OTP record
    await OTP.deleteOne({ _id: otpDoc._id });

    // Find customer by email or phone saved in OTP doc
    const customer = await Customer.findOne(
      buildOrFilterDefined({ email: otpDoc.email, phone: otpDoc.phone })
    );

    if (!customer) {
      logger.error(
        `Customer not found for verified OTP: ${otpDoc.email || otpDoc.phone}`
      );
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    // Check if blocked
    if (customer.blocked) {
      logger.warn(
        `Blocked customer attempted login: ${customer.email || customer.phone}`
      );
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Contact support.",
      });
    }

    const token = exports.generateToken(customer);
    logger.info(`Login successful for ${otpDoc.email || otpDoc.phone}`);

    // Check if user needs to complete profile
    // A user is "new" if they don't have firstName AND lastName
    // This means they just created account via OTP but haven't filled profile yet
    const isNewUser = !customer.firstName || !customer.lastName;

    logger.info(`User ${customer.email || customer.phone} - isNewUser: ${isNewUser}, hasFirstName: ${!!customer.firstName}, hasLastName: ${!!customer.lastName}`);

    return res.json({
      success: true,
      message: isNewUser ? "OTP verified. Please complete your profile." : "Login successful",
      token,
      isNewUser,
      customer: {
        _id: customer._id,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (err) {
    console.error("verifyLoginOtp error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// forgot password (enterprise)

exports.forgotPassword = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { identifier } = req.body;
  const identifierPayload = resolveIdentifier(identifier);
  const { normalizedEmail, normalizedPhone, type } = identifierPayload;

  logger.info({
    requestId,
    event: "CUSTOMER_FORGOT_PASSWORD_REQUEST",
    identifier: normalizedEmail || normalizedPhone,
    identifierType: type,
  });

  if (!type) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid registered email or phone number",
    });
  }

  try {
    const customer = await Customer.findOne(buildIdentifierFilter(identifierPayload));

    if (!customer) {
      logger.warn({
        requestId,
        event: "CUSTOMER_FORGOT_PASSWORD_CUSTOMER_NOT_FOUND",
        identifier: normalizedEmail || normalizedPhone,
        identifierType: type,
      });

      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (customer.authProvider && customer.authProvider !== "local") {
      return res.status(400).json({
        success: false,
        message: `Your account is signed in using ${customer.authProvider}. Please login using ${customer.authProvider}.`,
      });
    }

    if (!customer.password) {
      return res.status(400).json({
        success: false,
        message:
          "This account does not have a password. Please use your social login (e.g. Google) to access your account.",
      });
    }

    // Check if blocked
    if (customer.isBlocked) {
      logger.warn(`Blocked customer requested Forgot Password OTP: ${normalizedEmail || normalizedPhone}`);
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Cannot reset password.",
      });
    }

    const otpSettings = await OtpSettings.findOne();
    if (!otpSettings) {
      logger.error({
        requestId,
        event: "CUSTOMER_FORGOT_PASSWORD_SETTINGS_MISSING",
      });

      return res.status(500).json({
        success: false,
        message: "OTP settings not configured",
      });
    }

    const otpFilter = {
      ...buildIdentifierFilter(identifierPayload),
      context: CUSTOMER_OTP_CONTEXT.FORGOT_PASSWORD,
    };

    let otpDoc = await OTP.findOne(otpFilter);
    const resendWait = otpSettings.otpResendTime || 60;

    if (otpDoc?.blockUntil && otpDoc.blockUntil > new Date()) {
      const mins = Math.ceil((otpDoc.blockUntil - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} minute(s)`,
      });
    }

    if (otpDoc?.lastSentAt) {
      const timeSinceLastSent = Date.now() - otpDoc.lastSentAt.getTime();
      if (timeSinceLastSent < resendWait * 1000) {
        const secs = Math.ceil((resendWait * 1000 - timeSinceLastSent) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${secs} second(s) before requesting a new OTP`,
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpirySeconds = otpSettings.otpExpiryTime || 300;
    const otpExpiry = new Date(Date.now() + otpExpirySeconds * 1000);

    if (!otpDoc) {
      otpDoc = new OTP(otpFilter);
    }

    otpDoc.otp = otp;
    otpDoc.otpExpiry = otpExpiry;
    otpDoc.attempts = 0;
    otpDoc.lastSentAt = new Date();
    otpDoc.blockUntil = null;
    otpDoc.verified = false;
    otpDoc.context = CUSTOMER_OTP_CONTEXT.FORGOT_PASSWORD;

    await otpDoc.save();

    try {
      if (normalizedEmail) {
        await sendOTP(normalizedEmail, otp, "Password Reset OTP");
      } else if (normalizedPhone) {
        await sendSMS(normalizedPhone, otp);
      }
    } catch (channelErr) {
      logger.error({
        requestId,
        event: "CUSTOMER_FORGOT_PASSWORD_OTP_SEND_FAILED",
        identifier: normalizedEmail || normalizedPhone,
        identifierType: type,
        error: channelErr.message,
      });

      return res.status(500).json({
        success: false,
        message: type === "email"
          ? "Failed to send OTP email. Please try again."
          : "Failed to send OTP SMS. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: `OTP sent to your registered ${type === "email" ? "email" : "phone"}`,
      otpExpiry: otpExpiry
    });
  } catch (err) {
    logger.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifyForgotOtp = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { identifier, otp } = req.body;
  const identifierPayload = resolveIdentifier(identifier);
  const { normalizedEmail, normalizedPhone, type } = identifierPayload;

  logger.info({
    requestId,
    event: "CUSTOMER_FORGOT_PASSWORD_VERIFY_ATTEMPT",
    identifier: normalizedEmail || normalizedPhone,
    identifierType: type,
  });

  if (!type) {
    return res.status(400).json({
      success: false,
      message: "Please provide the same email or phone used to request OTP",
    });
  }

  try {
    const otpSettings = await OtpSettings.findOne();
    if (!otpSettings) {
      logger.error({
        requestId,
        event: "CUSTOMER_FORGOT_PASSWORD_VERIFY_SETTINGS_MISSING",
      });

      return res.status(500).json({
        success: false,
        message: "OTP settings not configured",
      });
    }

    const maxAttempts = otpSettings.maxOtpAttempts || 5;
    const blockTime = otpSettings.tempOtpBlockTime || 300;

    const otpDoc = await OTP.findOne({
      ...buildIdentifierFilter(identifierPayload),
      context: CUSTOMER_OTP_CONTEXT.FORGOT_PASSWORD,
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "OTP not found. Please request a new one.",
      });
    }

    if (otpDoc.blockUntil && otpDoc.blockUntil > new Date()) {
      const mins = Math.ceil((otpDoc.blockUntil - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} minute(s)`,
      });
    }

    if (!otpDoc.otp || new Date() > otpDoc.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    if (otpDoc.otp !== otp) {
      otpDoc.attempts += 1;
      if (otpDoc.attempts >= maxAttempts) {
        otpDoc.blockUntil = new Date(Date.now() + blockTime * 1000);
      }
      await otpDoc.save();

      return res.status(400).json({
        success: false,
        message: "Incorrect OTP",
      });
    }

    otpDoc.verified = true;
    otpDoc.otp = null;
    otpDoc.otpExpiry = null;
    otpDoc.attempts = 0;
    await otpDoc.save();

    return res.json({
      success: true,
      message: "OTP verified. You can now reset your password.",
    });
  } catch (err) {
    logger.error("Verify Forgot OTP Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { identifier, newPassword } = req.body;
  const identifierPayload = resolveIdentifier(identifier);
  const { normalizedEmail, normalizedPhone, type } = identifierPayload;

  logger.info({
    requestId,
    event: "CUSTOMER_FORGOT_PASSWORD_RESET_ATTEMPT",
    identifier: normalizedEmail || normalizedPhone,
    identifierType: type,
  });

  if (!type) {
    return res.status(400).json({
      success: false,
      message: "Please provide the same email or phone used earlier",
    });
  }

  try {
    const otpDoc = await OTP.findOne({
      ...buildIdentifierFilter(identifierPayload),
      context: CUSTOMER_OTP_CONTEXT.FORGOT_PASSWORD,
    });

    if (!otpDoc || !otpDoc.verified) {
      return res.status(400).json({
        success: false,
        message: "OTP verification required before resetting password",
      });
    }

    const customer = await Customer.findOne(buildIdentifierFilter(identifierPayload));

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    customer.password = await bcrypt.hash(newPassword, 10);
    customer.loginAttempts = 0;
    customer.loginBlockUntil = null;
    await customer.save();

    await OTP.deleteOne({ _id: otpDoc._id });

    if (customer.email) {
      try {
        await sendCustomerTemplateMail(
          customer.email,
          "password_reset_confirmation",
          {
            Name: customer.firstName || customer.email,
          }
        );
      } catch (emailErr) {
        logger.warn({
          requestId,
          event: "CUSTOMER_FORGOT_PASSWORD_CONFIRMATION_EMAIL_FAILED",
          userId: customer._id,
          error: emailErr.message,
        });
      }
    }

    return res.json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (err) {
    logger.error("Reset Password Error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const customer = await Customer.findById(req.user._id).select(
      "-password -otp -otpExpiry -blockUntil -lastSentAt"
    );

    if (!customer)
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });

    res.json({
      success: true,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        profilePhoto: customer.profilePhoto,
        birthday: customer.birthday,
      },
    });
  } catch (err) {
    console.error("getProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, password, birthday } = req.body;

    const customer = await Customer.findById(req.user._id);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    if (firstName) customer.firstName = firstName;
    if (lastName) customer.lastName = lastName;
    if (phone) customer.phone = phone;
    if (birthday) customer.birthday = new Date(birthday);

    // photo change
    if (req.file && req.file.path) {
      if (customer.profilePhoto) {
        await deleteFromCloudinary(customer.profilePhoto);
      }
      customer.profilePhoto = req.file.path;
    }

    // password update
    if (password) {
      customer.password = await bcrypt.hash(password, 10);
    }

    await customer.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        birthday: customer.birthday,
        profilePhoto: customer.profilePhoto,
      },
    });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { productId, rating, title, content } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== "active") {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    // Check if already reviewed
    const existing = await Review.findOne({
      product: productId,
      customer: customerId,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "You already reviewed this product" });
    }

    // Create review
    const review = await Review.create({
      product: product._id,
      customer: customerId,
      rating,
      title,
      content,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Review submitted for approval",
      review,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    const productId = req.params.productId || req.query.productId;
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID required" });
    }

    const reviews = await Review.find({
      product: productId,
      status: "published",
    })
      .populate({
        path: "customer",
        select: "firstName lastName profilePhoto",
      })
      .populate({
        path: "product",
        select: "productName shop",
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    console.error("getProductReviews error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(400)
        .json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.decode(token); // decode without verifying (token might be expired)

    const expiresAt =
      decoded && decoded.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Save token to blacklist
    await BlacklistedToken.create({ token, expiresAt });

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.blockCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    customer.isBlocked = true;
    customer.blockedAt = new Date();
    await customer.save();

    res.json({ success: true, message: "Customer blocked successfully" });
  } catch (err) {
    console.error("blockCustomer error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// UNBLOCK CUSTOMER
exports.unblockCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    customer.isBlocked = false;
    customer.blockedAt = null;
    await customer.save();

    res.json({ success: true, message: "Customer unblocked successfully" });
  } catch (err) {
    console.error("unblockCustomer error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const customerId = req.user._id;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    if (customer.profilePhotoId) {
      try {
        await cloudinary.uploader.destroy(customer.profilePhotoId);
      } catch (err) {
        console.error("Cloudinary photo delete failed:", err.message);
      }
    }

    await customer.deleteOne();

    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000) // convert seconds to ms
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // fallback 1 day

      await BlacklistedToken.create({ token, expiresAt });
    }

    return res.status(200).json({
      success: true,
      message: "Your account has been deleted successfully",
    });
  } catch (err) {
    console.error("deleteAccount error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.sendDeleteOtp = async (req, res) => {
  try {
    const customerId = req.user._id;
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const email = customer.email;
    const phone = customer.phone;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "No email or phone linked to your account",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP in DB
    let otpDoc = await OTP.findOne({ $or: [{ email }, { phone }] });
    if (!otpDoc) otpDoc = new OTP({ email, phone });
    otpDoc.otp = otp;
    otpDoc.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
    otpDoc.attempts = 0;
    otpDoc.createdAt = new Date();
    await otpDoc.save();

    // Send via email or SMS
    if (email) {
      await sendOTP(email, otp);
      await sendCustomerTemplateMail(email, "delete_account_verification", {
        Name: customer.firstName || "Customer",
        OTP: otp,
      });
    }
    if (phone) {
      await sendSMS(phone, otp);
    }

    return res.json({
      success: true,
      message: "OTP sent to your registered email or phone",
    });
  } catch (err) {
    console.error("sendDeleteOtp error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifyDeleteOtpAndDelete = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { otp } = req.body;

    if (!otp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }

    const otpDoc = await OTP.findOne({ otp }).sort({ createdAt: -1 });

    if (!otpDoc || !otpDoc.otpExpiry || Date.now() > otpDoc.otpExpiry) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Match OTP with logged-in user
    const customer = await Customer.findById(customerId);
    if (
      !customer ||
      (otpDoc.email && otpDoc.email !== customer.email) ||
      (otpDoc.phone && otpDoc.phone !== customer.phone)
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP does not match your account",
      });
    }

    // OTP valid → delete OTP record
    await OTP.deleteOne({ _id: otpDoc._id });

    // Delete profile photo if any
    if (customer.profilePhotoId) {
      try {
        await cloudinary.uploader.destroy(customer.profilePhotoId);
      } catch (err) {
        console.error("Cloudinary delete error:", err.message);
      }
    }

    // Delete customer
    await customer.deleteOne();

    // Blacklist token
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      await BlacklistedToken.create({ token, expiresAt });
    }

    return res.json({
      success: true,
      message: "Your account has been deleted successfully",
    });
  } catch (err) {
    console.error("verifyDeleteOtpAndDelete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.sendPasswordResetLink = async (req, res) => {
  try {
    const { email, phone } = req.body;

    logger.info("[SEND_RESET_LINK] Request received", {
      email: email || "not provided",
      phone: phone || "not provided",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (!email && !phone) {
      logger.warn("[SEND_RESET_LINK] Missing both email and phone");
      return res.status(400).json({
        success: false,
        message: "Email or phone number is required",
      });
    }

    const formattedPhone = phone
      ? phone.startsWith("+")
        ? phone
        : "+91" + phone
      : null;

    const customer = await Customer.findOne({
      $or: [{ email: email }, { phone: formattedPhone }],
    });

    if (!customer) {
      logger.warn("[SEND_RESET_LINK] Customer not found", {
        email,
        phone: formattedPhone,
      });

      return res.json({
        success: true,
        message:
          "If an account exists with this information, a password reset link has been sent to the registered email address.",
      });
    }

    // Check if blocked
    if (customer.isBlocked) {
      logger.warn("[SEND_RESET_LINK] Blocked customer attempted reset", {
        customerId: customer._id,
        email: customer.email,
      });
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Cannot reset password.",
      });
    }

    if (customer.authProvider && customer.authProvider !== "local") {
      logger.warn("[SEND_RESET_LINK] OAuth user tried password reset", {
        customerId: customer._id,
        provider: customer.authProvider,
      });

      if (!customer.password) {
  return res.status(400).json({
    success: false,
    message: "This account does not have a password. Please use your social login (e.g. Google) to access your account.",
  });
}

      return res.status(400).json({
        success: false,
        message: `This account was created using ${customer.authProvider.toUpperCase()} login. Please sign in using ${
          customer.authProvider
        } instead.`,
      });
    }

    if (customer.isBlocked) {
      logger.warn("[SEND_RESET_LINK] Blocked customer attempted reset", {
        customerId: customer._id,
        email: customer.email,
      });
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact support.",
      });
    }

    let targetEmail;

    if (email) {
      targetEmail = customer.email;
      logger.info("[SEND_RESET_LINK] Email-registered user", {
        customerId: customer._id,
        targetEmail,
      });
    } else if (phone) {
      if (!customer.email) {
        logger.warn("[SEND_RESET_LINK] Phone-registered user has no email", {
          customerId: customer._id,
          phone: customer.phone,
        });
        return res.status(400).json({
          success: false,
          message:
            "No email address associated with this phone number. Please contact support.",
        });
      }
      targetEmail = customer.email;
      logger.info(
        "[SEND_RESET_LINK] Phone-registered user, using profile email",
        {
          customerId: customer._id,
          phone: customer.phone,
          targetEmail,
        }
      );
    }

    const recentToken = await PasswordResetToken.findOne({
      customer: customer._id,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });

    if (recentToken) {
      logger.warn("[SEND_RESET_LINK] Rate limit hit - recent request exists", {
        customerId: customer._id,
        lastRequestAt: recentToken.createdAt,
      });
      return res.status(429).json({
        success: false,
        message:
          "A password reset link was recently sent. Please check your email or wait 5 minutes before requesting again.",
      });
    }

    await PasswordResetToken.updateMany(
      {
        customer: customer._id,
        used: false,
      },
      {
        $set: { used: true },
      }
    );

    logger.info("[SEND_RESET_LINK] Invalidated previous unused tokens", {
      customerId: customer._id,
    });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const tokenDoc = await PasswordResetToken.create({
      customer: customer._id,
      token: hashedToken,
      email: targetEmail,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("[SEND_RESET_LINK] Reset token created", {
      customerId: customer._id,
      tokenId: tokenDoc._id,
      expiresAt: tokenDoc.expiresAt,
    });

    const frontendUrl =
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_PROD
        : process.env.FRONTEND_LOCAL;

    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    logger.info("[SEND_RESET_LINK] Reset link generated", {
      customerId: customer._id,
      linkLength: resetLink.length,
    });

    try {
      const emailHTML = generatePasswordResetEmail(
        customer.firstName || "Customer",
        resetLink,
        "1 hour"
      );

      await sendEmail(
        targetEmail,
        "Reset Your Password - Action Required",
        emailHTML
      );

      logger.info("[SEND_RESET_LINK] Reset email sent successfully", {
        customerId: customer._id,
        email: targetEmail,
      });
    } catch (emailError) {
      logger.error("[SEND_RESET_LINK] Email sending failed", {
        customerId: customer._id,
        email: targetEmail,
        error: emailError.message,
        stack: emailError.stack,
      });

      await PasswordResetToken.deleteOne({ _id: tokenDoc._id });

      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    return res.json({
      success: true,
      message:
        "If an account exists with this information, a password reset link has been sent to the registered email address.",
    });
  } catch (err) {
    logger.error("[SEND_RESET_LINK] Unexpected error", {
      error: err.message,
      stack: err.stack,
      body: req.body,
    });

    return res.status(500).json({
      success: false,
      message:
        "An error occurred while processing your request. Please try again later.",
    });
  }
};
exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.query;

    logger.info("[VERIFY_RESET_TOKEN] Request received", {
      hasToken: !!token,
      ip: req.ip,
    });

    if (!token) {
      logger.warn("[VERIFY_RESET_TOKEN] Missing token");
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const tokenDoc = await PasswordResetToken.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      logger.warn("[VERIFY_RESET_TOKEN] Invalid token", {
        hashedToken: hashedToken.substring(0, 10) + "...",
      });
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    logger.info("[VERIFY_RESET_TOKEN] Valid token", {
      tokenId: tokenDoc._id,
      customerId: tokenDoc.customer,
    });

    return res.json({
      success: true,
      message: "Token is valid",
      email: tokenDoc.email,
    });
  } catch (err) {
    logger.error("[VERIFY_RESET_TOKEN] Error", {
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    logger.info("[RESET_PASSWORD_TOKEN] Request received", {
      hasToken: !!token,
      hasNewPassword: !!newPassword,
      hasConfirmPassword: !!confirmPassword,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (!token) {
      logger.warn("[RESET_PASSWORD_TOKEN] Missing token");
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!newPassword || !confirmPassword) {
      logger.warn("[RESET_PASSWORD_TOKEN] Missing password fields");
      return res.status(400).json({
        success: false,
        message: "New password and confirmation are required",
      });
    }

    if (newPassword !== confirmPassword) {
      logger.warn("[RESET_PASSWORD_TOKEN] Password mismatch");
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      logger.warn("[RESET_PASSWORD_TOKEN] Password too short");
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    logger.info("[RESET_PASSWORD_TOKEN] Token hashed, searching database");

    const tokenDoc = await PasswordResetToken.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    }).populate("customer");

    if (!tokenDoc) {
      logger.warn("[RESET_PASSWORD_TOKEN] Invalid or expired token", {
        hashedToken: hashedToken.substring(0, 10) + "...",
      });
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired reset token. Please request a new password reset link.",
      });
    }

    logger.info("[RESET_PASSWORD_TOKEN] Valid token found", {
      tokenId: tokenDoc._id,
      customerId: tokenDoc.customer._id,
      email: tokenDoc.email,
    });

    const customer = tokenDoc.customer;

    if (customer.isBlocked) {
      logger.warn("[RESET_PASSWORD_TOKEN] Blocked customer attempted reset", {
        customerId: customer._id,
        email: customer.email,
      });

      tokenDoc.used = true;
      await tokenDoc.save();

      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact support.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    logger.info("[RESET_PASSWORD_TOKEN] Password hashed, updating customer");

    customer.password = hashedPassword;
    customer.loginAttempts = 0;
    customer.loginBlockUntil = null;

    await customer.save();

    logger.info("[RESET_PASSWORD_TOKEN] Customer password updated", {
      customerId: customer._id,
      email: customer.email,
    });

    tokenDoc.used = true;
    await tokenDoc.save();

    logger.info("[RESET_PASSWORD_TOKEN] Token marked as used", {
      tokenId: tokenDoc._id,
    });

    try {
      const emailHTML = generatePasswordResetSuccessEmail(
        customer.firstName || "Customer",
        new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "full",
          timeStyle: "short",
        }),
        req.ip || "Unknown"
      );

      await sendEmail(
        customer.email,
        "Password Reset Successful - Your Account is Secure",
        emailHTML
      );

      logger.info("[RESET_PASSWORD_TOKEN] Confirmation email sent", {
        customerId: customer._id,
        email: customer.email,
      });
    } catch (emailError) {
      logger.error("[RESET_PASSWORD_TOKEN] Confirmation email failed", {
        customerId: customer._id,
        error: emailError.message,
      });
    }

    logger.info(
      "[RESET_PASSWORD_TOKEN] Password reset completed successfully",
      {
        customerId: customer._id,
        email: customer.email,
      }
    );

    return res.json({
      success: true,
      message:
        "Password reset successfully. You can now login with your new password.",
    });
  } catch (err) {
    logger.error("[RESET_PASSWORD_TOKEN] Unexpected error", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      message:
        "An error occurred while resetting your password. Please try again later.",
    });
  }
};