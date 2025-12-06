const jwt = require("jsonwebtoken");
const OTP = require("../models/OTPModel");
const verifyCaptcha = require("../utils/verifyCaptcha");
const User = require("../models/User");
const { createAndEmitNotification } = require("../helpers/notification");
const { validationResult } = require("express-validator");
const BlacklistedToken = require("../models/BlacklistedToken");

const Student = require("../models/student");
const Shop = require("../models/Shop");
const Product = require("../models/productModel");

const cloudinary = require("../config/cloudinary");
const { sendOTP, sendEmail } = require("../utils/mailer");
const { sendSMS } = require("../utils/sms");
const bcrypt = require("bcryptjs");
const AdminMailTemplate = require("../models/AdminMailTemplate");
const SupplierMailTemplate = require("../models/SupplierMailTemplate");
const OtpSettings = require("../models/OtpSettings");
const crypto = require("crypto");
const logger = require("../config/logger");

function getIconId(name) {
  const map = {
    facebook: "733547",
    instagram: "733558",
    x: "5969020",
    linkedin: "733561",
    youtube: "733646",
  };
  return map[name.toLowerCase()] || "733585";
}

async function sendSupplierTemplateMail(to, type, placeholders = {}) {
  const template = await SupplierMailTemplate.findOne({ templateType: type });
  if (!template || !template.isActive) {
    console.log(` Supplier Template not found or inactive: ${type}`);
    return;
  }

  // Replace placeholders in body
  let mailBody = template.mailBody;
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`{${key}}`, "gi");
    mailBody = mailBody.replace(regex, value);
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

  // Social links
  const iconMap = {
    facebook: "https://cdn-icons-png.flaticon.com/512/733/733547.png",
    instagram: "https://cdn-icons-png.flaticon.com/512/733/733558.png",
    x: "https://cdn-icons-png.flaticon.com/512/5969/5969020.png",
    linkedin: "https://cdn-icons-png.flaticon.com/512/733/733561.png",
    youtube: "https://cdn-icons-png.flaticon.com/512/733/733646.png",
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

  // Final HTML
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
        <img src="${template.iconUrl}" alt="Logo" style="height:60px;"/>
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

const OTP_CONTEXT = {
  SIGNUP: "signup",
  LOGIN: "login",
  FORGOT_PASSWORD: "forgot_password",
  GENERIC: "generic",
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

// signup for shopkeeper
exports.sendSignupOtp = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { email, phone, password } = req.body;
  const { ref } = req.body;

  logger.info({
    requestId,
    event: "SIGNUP_OTP_REQUEST",
    email: email ? email.toLowerCase() : undefined,
    phone: phone
      ? phone.startsWith("+91")
        ? phone
        : "+91" + phone
      : undefined,
    hasRef: !!ref,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      requestId,
      event: "SIGNUP_VALIDATION_FAILED",
      errors: errors.array().map((e) => ({ field: e.param, message: e.msg })),
    });

    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  if (!email && !phone) {
    logger.warn({
      requestId,
      event: "SIGNUP_MISSING_IDENTIFIER",
      message: "Email or Phone required",
    });
    return res.status(400).json({ message: "Email or Phone is required" });
  }

  if (!password) {
    logger.warn({
      requestId,
      event: "SIGNUP_MISSING_PASSWORD",
    });
    return res.status(400).json({ message: "Password is required" });
  }

  // Password strength validation
  if (password.length < 8) {
    logger.warn({
      requestId,
      event: "SIGNUP_WEAK_PASSWORD",
      reason: "Password too short",
    });
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  try {
    let normalizedEmail = email ? email.trim().toLowerCase() : undefined;
    let normalizedPhone = phone
      ? phone.startsWith("+91")
        ? phone
        : "+91" + phone
      : undefined;

    logger.debug({
      requestId,
      event: "SIGNUP_CHECKING_EXISTING_USER",
      normalizedEmail,
      normalizedPhone,
    });

    // Dynamic query for existing user
    const queryConditions = [];
    if (normalizedEmail) queryConditions.push({ email: normalizedEmail });
    if (normalizedPhone) queryConditions.push({ phone: normalizedPhone });

    let existingUser = null;
    if (queryConditions.length > 0) {
      existingUser = await User.findOne({ $or: queryConditions });
    }

    if (existingUser) {
      logger.warn({
        requestId,
        event: "SIGNUP_USER_ALREADY_EXISTS",
        existingEmail: !!existingUser.email,
        existingPhone: !!existingUser.phone,
        userId: existingUser._id,
      });

      return res
        .status(400)
        .json({ message: "Email or phone already registered" });
    }

    const otpSettings = await OtpSettings.findOne();
    if (!otpSettings) {
      return res
        .status(500)
        .json({ message: "OTP settings not configured by admin" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(
      Date.now() + otpSettings.tempOtpBlockTime * 1000
    );

    // Normalize

    // Save OTP (email or phone based)
    const otpDoc = await OTP.findOneAndUpdate(
      { $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] },
      {
        otp,
        otpExpiry,
        createdAt: new Date(),
        attempts: 0,
        email: normalizedEmail,
        phone: normalizedPhone,
        context: OTP_CONTEXT.SIGNUP,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log("OTP saved:", otpDoc);

    const hashedPassword = await bcrypt.hash(password, 10);

    // Store signup data in OTP document temporarily
    otpDoc.signupData = {
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      refBy: ref || null,
    };
    await otpDoc.save();

    console.log("Signup data stored in OTP document (pending verification)");

    // Commenting out premature admin notification
    /* 
    // Admin mail template if shopkeeper request
    if (false) { // Disabled - user doesn't exist yet
      const template = await AdminMailTemplate.findOne();
      if (template && template.isActive) {
        let pageLinksHtml = "";
        for (const [key, value] of Object.entries(template.pageLinks || {})) {
          if (value.enabled) {
            pageLinksHtml += `<a href="${
              value.url
            }" style="margin:0 8px; color:#007bff; text-decoration:none;">${key.replace(
              /([A-Z])/g,
              " $1"
            )}</a>`;
          }
        }

        let socialLinksHtml = "";
        for (const [key, value] of Object.entries(
          template.socialMediaLinks || {}
        )) {
          if (value.enabled && value.url) {
            socialLinksHtml += `
              <a href="${value.url}" style="margin:0 5px;" target="_blank">
                <img src="https://cdn-icons-png.flaticon.com/24/733/${getIconId(
                  key
                )}.png"
                     alt="${key}" height="24" style="vertical-align:middle"/>
              </a>
            `;
          }
        }

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px; background:#fff; border:1px solid #e0e0e0; border-radius:8px;">
            <div style="text-align:center; margin-bottom:20px;">
              <img src="${template.logoUrl}" alt="Logo" style="height:60px;"/>
            </div>
            <h2 style="text-align:left; color:#333;">${template.title}</h2>
            <p style="text-align:left; color:#555; font-size:15px; line-height:1.6;">
              ${template.mailBody.replace("{Admin Name}", "Admin")}
            </p>
            <div style="margin:20px 0;">
              <a href="https://test-dobby.vercel.app/Admin"
                 style="padding: 12px 20px; background: #007bff; color: #fff; text-decoration: none; border-radius:4px;">
                 Log in to Admin Panel
              </a>
            </div>
            <p style="color:#555; font-size:14px; line-height:1.6;">
              ${
                template.footerSectionText ||
                "Please contact us for any queries, we’re always happy to help."
              }
            </p>
            <p style="margin:20px 0 10px; font-weight:bold;">Thanks & Regards,<br/>Dobby Mall</p>
            <ul style="list-style:none; padding:0; margin:15px 0;">
              ${Object.entries(template.pageLinks || {})
                .map(([key, value]) =>
                  value.enabled
                    ? `<li style="margin:5px 0;">
                         <a href="${
                           value.url
                         }" style="color:#007bff; text-decoration:none;">
                           ${key.replace(/([A-Z])/g, " $1")}
                         </a>
                       </li>`
                    : ""
                )
                .join("")}
            </ul>
            <div style="margin:20px 0; text-align:center;">
              ${Object.entries(template.socialMediaLinks || {})
                .map(([key, value]) =>
                  value.enabled && value.url
                    ? `<a href="${
                        value.url
                      }" target="_blank" style="margin:0 6px; display:inline-block;">
                         <img src="https://cdn-icons-png.flaticon.com/24/733/${getIconId(
                           key
                         )}.png" 
                              alt="${key}" height="24"/>
                       </a>`
                    : ""
                )
                .join("")}
            </div>
            <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;"/>
            <p style="font-size:12px; color:#888; text-align:center;">
              ${template.copyrightText}
            </p>
          </div>
        `;

        await sendEmail(
          process.env.ADMIN_EMAIL,
          "New Shopkeeper Request",
          htmlContent
        );
      }
    }
    */

    if (normalizedEmail) {
      try {
        await sendOTP(normalizedEmail, otp);
        logger.info({
          requestId,
          event: "SIGNUP_OTP_SENT_EMAIL",
          success: true,
        });
      } catch (emailErr) {
        logger.error({
          requestId,
          event: "SIGNUP_OTP_SEND_FAILED",
          channel: "email",
          error: emailErr.message,
        });
        throw new Error("Failed to send OTP email");
      }
    }
    if (normalizedPhone) {
      try {
        await sendSMS(normalizedPhone, otp);
        logger.info({ requestId, event: "SIGNUP_OTP_SENT_SMS", success: true });
      } catch (smsErr) {
        logger.error({
          requestId,
          event: "SIGNUP_OTP_SEND_FAILED",
          channel: "sms",
          error: smsErr.message,
        });
        throw new Error("Failed to send OTP SMS");
      }
    }

    logger.info({
      requestId,
      event: "SIGNUP_OTP_SUCCESS",
      message: "OTP sent successfully",
    });
    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      otpExpiry: otpExpiry,
    });
  } catch (error) {
    logger.error({
      requestId,
      event: "SIGNUP_OTP_ERROR",
      error: error.message,
      stack: error.stack,
    });

    return res
      .status(500)
      .json({ message: "Failed to send OTP", error: error.message });
  }
};

exports.verifyOTP = async (req, res) => {
  const { otp } = req.body;
  console.log("Verify request body:", req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  if (!otp) {
    return res.status(400).json({ message: "OTP is required" });
  }

  try {
    const otpSettings = await OtpSettings.findOne();
    if (!otpSettings) {
      return res
        .status(500)
        .json({ message: "OTP settings not configured by admin" });
    }

    // Latest OTP record fetch
    const rawRecord = await OTP.findOne({ otp }).sort({ createdAt: -1 });
    console.log(
      "OTP from DB:",
      rawRecord ? rawRecord.otp : null,
      "OTP from frontend:",
      otp
    );

    // Wrong OTP handling
    //  Check if OTP record exists
    if (!rawRecord) return res.status(401).json({ message: "Invalid OTP" });

    const normalizedEmail = rawRecord.email
      ? rawRecord.email.trim().toLowerCase()
      : undefined;
    const normalizedPhone = rawRecord.phone
      ? rawRecord.phone.startsWith("+91")
        ? rawRecord.phone
        : "+91" + rawRecord.phone
      : undefined;

    //  Check blocked
    if (rawRecord.blockUntil && rawRecord.blockUntil > new Date()) {
      return res.status(429).json({ message: "Too many attempts. Try later." });
    }

    //  Check expiry
    if (rawRecord.otpExpiry < new Date()) {
      return res.status(401).json({ message: "OTP expired" });
    }

    //  Check wrong OTP
    if (rawRecord.otp !== otp) {
      rawRecord.attempts += 1;
      if (rawRecord.attempts >= otpSettings.maxOtpAttempts) {
        rawRecord.blockUntil = new Date(
          Date.now() + otpSettings.tempOtpBlockTime * 1000
        );
        await rawRecord.save();
        return res
          .status(429)
          .json({ message: "Too many wrong attempts. Try later." });
      }
      await rawRecord.save();
      return res.status(401).json({ message: "Invalid OTP" });
    }

    let user;
    if (normalizedEmail) {
      user = await User.findOne({ email: normalizedEmail });
    }
    if (!user && normalizedPhone) {
      user = await User.findOne({ phone: normalizedPhone });
    }

    // If user doesn't exist, create from signupData
    if (!user) {
      if (!rawRecord.signupData) {
        return res.status(404).json({
          success: false,
          message: "Signup data not found. Please signup first.",
        });
      }

      // Create user from stored signup data
      user = await User.create({
        email: rawRecord.signupData.email,
        phone: rawRecord.signupData.phone,
        password: rawRecord.signupData.password,
        refBy: rawRecord.signupData.refBy,
        status: "pending",
        emailVerified: !!rawRecord.signupData.email,
        phoneVerified: !!rawRecord.signupData.phone,
      });

      console.log(" User created after OTP verification:", user._id);
    } else {
      // Existing user - just mark verified
      if (normalizedEmail) user.emailVerified = true;
      if (normalizedPhone) user.phoneVerified = true;
      await user.save();
      console.log(" Existing user verified:", user._id);
    }

    // OTP consume - clear after successful verification
    rawRecord.otp = null;
    rawRecord.signupData = null; // Clear signup data after user creation
    await rawRecord.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. Please complete your profile.",
      userId: user._id,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res
      .status(500)
      .json({ message: "OTP verification failed", error: error.message });
  }
};

exports.completeProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    const { userId, firstName, lastName, phone, shopName, shopAddress, ref } =
      req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.emailVerified && !user.phoneVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email or phone before completing profile",
      });
    }

    if (ref || user.refBy) {
      const affiliateCode = ref || user.refBy;
      const student = await Student.findOne({ affiliateCode });
      if (student) {
        user.referredBy = student._id;
        user.refBy = affiliateCode;
      }
    }

    // Update profile fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone.startsWith("+91") ? phone : "+91" + phone;

    if (shopName) user.shopName = shopName;
    if (shopAddress) user.shopAddress = shopAddress;

    if (!user.status) {
      user.status = "pending";
    }

    await user.save();

    console.log(" Profile completed for user:", user._id);

    // Send notification to admin about new shopkeeper registration
    try {
      const shopkeeperName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || user.phone || "Shopkeeper";
      
      await createAndEmitNotification({
        title: "New Shopkeeper Registered",
        message: `${shopkeeperName} has completed shopkeeper registration${user.shopName ? ` (${user.shopName})` : ""}`,
        event: "SHOPKEEPER_REGISTERED",
        targetModels: ["Admin"],
        meta: {
          shopkeeperId: user._id,
          shopkeeperName: shopkeeperName,
          email: user.email,
          phone: user.phone,
          shopName: user.shopName || null,
          shopAddress: user.shopAddress || null,
          status: user.status,
          referredBy: user.referredBy || null,
          registeredAt: user.createdAt || new Date(),
        },
      });

      logger.info({
        event: "ADMIN_SHOPKEEPER_NOTIFICATION_SENT",
        shopkeeperId: user._id,
        shopkeeperName: shopkeeperName,
      });
    } catch (notifErr) {
      logger.error({
        event: "ADMIN_SHOPKEEPER_NOTIFICATION_FAILED",
        shopkeeperId: user._id,
        error: notifErr.message,
      });
      // Don't fail registration if notification fails
    }

    if (user.status === "pending") {
      try {
        const template = await AdminMailTemplate.findOne();
        if (template && template.isActive) {
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px; background:#fff; border:1px solid #e0e0e0; border-radius:8px;">
              <div style="text-align:center; margin-bottom:20px;">
                <img src="${template.logoUrl}" alt="Logo" style="height:60px;"/>
              </div>
              <h2 style="text-align:left; color:#333;">${template.title}</h2>
              <p style="text-align:left; color:#555; font-size:15px; line-height:1.6;">
                A new shopkeeper has completed registration:<br/><br/>
                <strong>Name:</strong> ${user.firstName || ""} ${
            user.lastName || ""
          }<br/>
                <strong>Email:</strong> ${user.email || "N/A"}<br/>
                <strong>Phone:</strong> ${user.phone || "N/A"}<br/>
                <strong>Shop Name:</strong> ${user.shopName || "N/A"}<br/>
                <strong>Shop Address:</strong> ${user.shopAddress || "N/A"}<br/>
              </p>
              <div style="margin:20px 0;">
                <a href="https://test-dobby.vercel.app/Admin"
                   style="padding: 12px 20px; background: #007bff; color: #fff; text-decoration: none; border-radius:4px;">
                   Log in to Admin Panel to Approve
                </a>
              </div>
              <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;"/>
              <p style="font-size:12px; color:#888; text-align:center;">
                ${
                  template.copyrightText || "© Dobby Mall. All rights reserved."
                }
              </p>
            </div>
          `;

          await sendEmail(
            process.env.ADMIN_EMAIL,
            "New Shopkeeper Profile Completed",
            htmlContent
          );
          console.log(" Admin notification sent");
        }
      } catch (emailErr) {
        console.error("Admin email failed (non-blocking):", emailErr.message);
      }
    }

    // Student referral notification - if shopkeeper registered using student referral link
    if (user.referredBy) {
      try {
        const student = await Student.findById(user.referredBy).select(
          "_id fullName affiliateCode"
        );

        if (student) {
          const shopkeeperName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || user.phone || "User";
          
          await createAndEmitNotification({
            title: "New Shopkeeper Registered via Your Referral!",
            message: `${shopkeeperName} has registered as a shopkeeper using your referral link${user.shopName ? ` (Shop: ${user.shopName})` : ""}`,
            event: "STUDENT_REFERRAL_SHOPKEEPER_REGISTERED",
            targetUsers: [{ userId: student._id, userModel: "Student" }],
            meta: {
              shopkeeperId: user._id,
              shopkeeperName: shopkeeperName,
              shopkeeperEmail: user.email,
              shopkeeperPhone: user.phone,
              shopName: user.shopName || "N/A",
              shopAddress: user.shopAddress || null,
              studentId: student._id,
              studentName: student.fullName,
              affiliateCode: student.affiliateCode,
              stage: "registration",
              registeredAt: user.createdAt || new Date(),
            },
          });

          logger.info({
            event: "STUDENT_REFERRAL_NOTIFICATION_SENT",
            shopkeeperId: user._id,
            studentId: student._id,
          });
        }
      } catch (studentNotifErr) {
        logger.error({
          event: "STUDENT_REFERRAL_NOTIFICATION_FAILED",
          shopkeeperId: user._id,
          error: studentNotifErr.message,
        });
        // Don't fail registration if student notification fails
      }
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: "shopkeeper",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    if (user.email) {
      await sendSupplierTemplateMail(user.email, "registration_complete", {
        "Shopkeeper Name": `${user.firstName || ""} ${
          user.lastName || ""
        }`.trim(),
      });
    }

    res.json({
      success: true,
      message: "Signup completed successfully",
      token,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,

        shopName: user.shopName,
        shopAddress: user.shopAddress,
        role: user.role,
        status: user.status, // include pending status
      },
    });
  } catch (err) {
    console.error("Complete Profile Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.shopkeeperLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Email or Phone and password are required" });
    }

    // const captchaOk = await verifyCaptcha(captchaToken);
    // if (!captchaOk)
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "Captcha verification failed" });

    const otpSettings = await OtpSettings.findOne();
    if (!otpSettings) {
      return res
        .status(500)
        .json({ message: "OTP/Login settings not configured by admin" });
    }

    let normalizedIdentifier = identifier.trim();
    if (normalizedIdentifier.includes("@")) {
      normalizedIdentifier = normalizedIdentifier.toLowerCase(); // email normalize
    } else if (/^\d{10}$/.test(normalizedIdentifier)) {
      normalizedIdentifier = "+91" + normalizedIdentifier; // phone normalize
    }

    const user = await User.findOne({
      role: "shopkeeper",
      $or: [{ email: normalizedIdentifier }, { phone: normalizedIdentifier }],
    });

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.emailVerified && !user.phoneVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email or phone first" });
    }

    if (user.loginBlockUntil && user.loginBlockUntil > new Date()) {
      return res
        .status(429)
        .json({ message: "Too many login attempts. Try later." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= otpSettings.maxLoginAttempts) {
        user.loginBlockUntil = new Date(
          Date.now() + otpSettings.tempLoginBlockTime * 1000
        );
      }
      await user.save();
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isBlocked)
      return res
        .status(403)
        .json({ message: "Your account has been blocked by admin." });
    if (user.status !== "approved")
      return res
        .status(403)
        .json({ message: "Your account is pending admin approval." });

    user.loginAttempts = 0;
    user.loginBlockUntil = null;
    await user.save();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(
      Date.now() + otpSettings.tempOtpBlockTime * 1000
    );

    await OTP.findOneAndUpdate(
      { $or: [{ email: user.email }, { phone: user.phone }] },
      {
        otp,
        otpExpiry,
        createdAt: new Date(),
        attempts: 0,
        email: user.email,
        phone: user.phone,
        context: OTP_CONTEXT.LOGIN,
      },
      { upsert: true, new: true }
    );

    if (user.email && identifier.includes("@")) {
      await sendOTP(user.email, otp); // Email OTP
    } else if (user.phone) {
      const formattedPhone = user.phone.startsWith("+")
        ? user.phone
        : "+91" + user.phone;
      await sendSMS(formattedPhone, otp); // Phone OTP
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      otpExpiry: otpExpiry,
      tempUserId: user._id,
    });
  } catch (error) {
    console.error("Shopkeeper Login Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.verifyLoginOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    const { otp } = req.body;

    if (!otp) return res.status(400).json({ message: "OTP is required" });

    const otpSettings = await OtpSettings.findOne();
    if (!otpSettings)
      return res
        .status(500)
        .json({ message: "OTP settings not configured by admin" });

    // Find latest OTP record
    const record = await OTP.findOne({ otp }).sort({ createdAt: -1 });
    if (!record)
      return res.status(401).json({ message: "Invalid OTP or request again" });

    // Blocked check
    if (record.blockUntil && record.blockUntil > new Date()) {
      return res.status(429).json({ message: "Too many attempts. Try later." });
    }

    // Expiry check
    if (record.otpExpiry < new Date()) {
      return res.status(401).json({ message: "OTP expired" });
    }

    // Find user
    let user = null;
    if (record.email) user = await User.findOne({ email: record.email });
    if (!user && record.phone)
      user = await User.findOne({ phone: record.phone });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Account checks (same as login)
    if (user.isBlocked)
      return res
        .status(403)
        .json({ message: "Your account has been blocked by admin." });
    if (user.status !== "approved")
      return res
        .status(403)
        .json({ message: "Your account is pending admin approval." });

    // Consume OTP
    record.otp = null;
    record.verified = true;
    await record.save();

    // Mark user verified
    if (record.email) user.emailVerified = true;
    if (record.phone) user.phoneVerified = true;
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password: _, ...userWithoutPassword } = user.toObject();

    return res.status(200).json({
      success: true,
      message: "OTP verified, login successful",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Verify Login OTP Error:", error);
    return res
      .status(500)
      .json({ message: "OTP verification failed", error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      success: true,
      profile: user,
    });
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phone, shopName, shopAddress } = req.body;

    let updateData = {
      firstName,
      lastName,
      phone,
      shopName,
      shopAddress,
    };

    if (req.file) {
      const user = await User.findById(userId);

      if (user?.profile?.public_id) {
        try {
          await cloudinary.uploader.destroy(user.profile.public_id);
        } catch (delErr) {
          console.warn("Old image delete failed:", delErr.message);
        }
      }

      updateData["profile"] = {
        url: req.file.path,
        public_id: req.file.filename,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    return res.json({
      success: true,
      message: "Profile updated successfully",
      profile: updatedUser,
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.forgotPasswordSendOtp = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { identifier } = req.body;
  const identifierPayload = resolveIdentifier(identifier);
  const { normalizedEmail, normalizedPhone, type } = identifierPayload;

  logger.info({
    requestId,
    event: "FORGOT_PASSWORD_REQUEST",
    identifier: normalizedEmail || normalizedPhone,
    identifierType: type,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  if (!type) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid registered email or phone number",
    });
  }

  try {
    const userQuery = {
      role: "shopkeeper",
      ...(normalizedEmail
        ? { email: normalizedEmail }
        : { phone: normalizedPhone }),
    };

    const user = await User.findOne(userQuery);

    if (!user) {
      logger.warn({
        requestId,
        event: "FORGOT_PASSWORD_USER_NOT_FOUND",
        identifier: normalizedEmail || normalizedPhone,
        identifierType: type,
      });

      return res.status(404).json({
        success: false,
        message: "No account found with this identifier",
      });
    }

    const otpSettings = await OtpSettings.findOne();
    if (!otpSettings) {
      logger.error({
        requestId,
        event: "FORGOT_PASSWORD_SETTINGS_MISSING",
      });

      return res.status(500).json({
        success: false,
        message: "OTP settings not configured",
      });
    }

    const otpFilter = buildIdentifierFilter(identifierPayload);
    let otpDoc = await OTP.findOne(otpFilter);
    const isForgotContext = otpDoc?.context === OTP_CONTEXT.FORGOT_PASSWORD;

    if (
      isForgotContext &&
      otpDoc.blockUntil &&
      otpDoc.blockUntil > new Date()
    ) {
      const mins = Math.ceil((otpDoc.blockUntil - new Date()) / 60000);

      logger.warn({
        requestId,
        event: "FORGOT_PASSWORD_BLOCKED",
        userId: user._id,
        blockUntil: otpDoc.blockUntil.toISOString(),
        identifierType: type,
      });

      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} minute(s)`,
      });
    }

    const resendWait = otpSettings.otpResendTime || 60;
    if (isForgotContext && otpDoc?.lastSentAt) {
      const timeSinceLastSent = Date.now() - otpDoc.lastSentAt.getTime();
      if (timeSinceLastSent < resendWait * 1000) {
        const secs = Math.ceil((resendWait * 1000 - timeSinceLastSent) / 1000);

        logger.warn({
          requestId,
          event: "FORGOT_PASSWORD_RESEND_TOO_SOON",
          userId: user._id,
          waitSeconds: secs,
          identifierType: type,
        });

        return res.status(429).json({
          success: false,
          message: `Please wait ${secs} second(s) before requesting a new OTP`,
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(
      Date.now() + otpSettings.tempOtpBlockTime * 1000
    );

    logger.info({
      requestId,
      event: "FORGOT_PASSWORD_OTP_GENERATED",
      userId: user._id,
      otpExpiry: otpExpiry.toISOString(),
      identifierType: type,
    });

    if (!otpDoc) {
      otpDoc = new OTP(otpFilter);
    }

    otpDoc.otp = otp;
    otpDoc.otpExpiry = otpExpiry;
    otpDoc.attempts = 0;
    otpDoc.lastSentAt = new Date();
    otpDoc.blockUntil = null;
    otpDoc.verified = false;
    otpDoc.context = OTP_CONTEXT.FORGOT_PASSWORD;

    await otpDoc.save();

    logger.debug({
      requestId,
      event: "FORGOT_PASSWORD_OTP_SAVED",
      otpDocId: otpDoc._id,
      identifierType: type,
    });

    try {
      if (normalizedEmail) {
        await sendOTP(normalizedEmail, otp, "Password Reset OTP");
      } else if (normalizedPhone) {
        await sendSMS(normalizedPhone, otp);
      }

      logger.info({
        requestId,
        event: "FORGOT_PASSWORD_OTP_SENT",
        userId: user._id,
        channel: type,
        success: true,
      });
    } catch (channelErr) {
      logger.error({
        requestId,
        event: "FORGOT_PASSWORD_OTP_SEND_FAILED",
        userId: user._id,
        channel: type,
        error: channelErr.message,
      });

      return res.status(500).json({
        success: false,
        message:
          type === "email"
            ? "Failed to send OTP email. Please try again."
            : "Failed to send OTP SMS. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: `OTP sent to your registered ${
        type === "email" ? "email" : "phone"
      }`,
      otpExpiry: otpExpiry,
    });
  } catch (error) {
    logger.error({
      requestId,
      event: "FORGOT_PASSWORD_ERROR",
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

exports.forgotPasswordVerifyOtp = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { identifier, otp } = req.body;
  const identifierPayload = resolveIdentifier(identifier);
  const { normalizedEmail, normalizedPhone, type } = identifierPayload;

  logger.info({
    requestId,
    event: "FORGOT_PASSWORD_OTP_VERIFICATION_ATTEMPT",
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
        event: "FORGOT_PASSWORD_VERIFY_SETTINGS_MISSING",
      });

      return res.status(500).json({
        success: false,
        message: "OTP settings not configured",
      });
    }

    const maxAttempts = otpSettings.maxOtpAttempts || 5;
    const blockTime = otpSettings.tempOtpBlockTime || 300;

    const otpFilter = {
      ...buildIdentifierFilter(identifierPayload),
      context: OTP_CONTEXT.FORGOT_PASSWORD,
    };

    const otpDoc = await OTP.findOne(otpFilter);

    if (!otpDoc) {
      logger.warn({
        requestId,
        event: "FORGOT_PASSWORD_VERIFY_OTP_NOT_FOUND",
        identifier: normalizedEmail || normalizedPhone,
        identifierType: type,
      });

      return res.status(400).json({
        success: false,
        message: "OTP not found. Please request a new one.",
      });
    }

    if (otpDoc.blockUntil && otpDoc.blockUntil > new Date()) {
      const mins = Math.ceil((otpDoc.blockUntil - new Date()) / 60000);

      logger.warn({
        requestId,
        event: "FORGOT_PASSWORD_VERIFY_BLOCKED",
        identifier: normalizedEmail || normalizedPhone,
        blockUntil: otpDoc.blockUntil.toISOString(),
      });

      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} minute(s)`,
      });
    }

    if (!otpDoc.otp || new Date() > otpDoc.otpExpiry) {
      logger.warn({
        requestId,
        event: "FORGOT_PASSWORD_VERIFY_OTP_EXPIRED",
        identifier: normalizedEmail || normalizedPhone,
      });

      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    if (otpDoc.otp !== otp) {
      otpDoc.attempts += 1;

      if (otpDoc.attempts >= maxAttempts) {
        otpDoc.blockUntil = new Date(Date.now() + blockTime * 1000);

        logger.warn({
          requestId,
          event: "FORGOT_PASSWORD_VERIFY_MAX_ATTEMPTS",
          identifier: normalizedEmail || normalizedPhone,
          attempts: otpDoc.attempts,
          blockUntil: otpDoc.blockUntil.toISOString(),
        });
      } else {
        logger.warn({
          requestId,
          event: "FORGOT_PASSWORD_VERIFY_WRONG_OTP",
          identifier: normalizedEmail || normalizedPhone,
          attempts: otpDoc.attempts,
        });
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
    otpDoc.blockUntil = null;
    await otpDoc.save();

    logger.info({
      requestId,
      event: "FORGOT_PASSWORD_OTP_VERIFIED",
      identifier: normalizedEmail || normalizedPhone,
    });

    return res.json({
      success: true,
      message: "OTP verified successfully. You can now reset your password.",
    });
  } catch (error) {
    logger.error({
      requestId,
      event: "FORGOT_PASSWORD_VERIFY_ERROR",
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

exports.forgotPasswordReset = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { identifier, newPassword } = req.body;
  const identifierPayload = resolveIdentifier(identifier);
  const { normalizedEmail, normalizedPhone, type } = identifierPayload;

  logger.info({
    requestId,
    event: "FORGOT_PASSWORD_RESET_ATTEMPT",
    identifier: normalizedEmail || normalizedPhone,
    identifierType: type,
  });

  if (!type) {
    return res.status(400).json({
      success: false,
      message: "Please provide the same email or phone used earlier",
    });
  }

  if (!newPassword || newPassword.length < 8) {
    logger.warn({
      requestId,
      event: "FORGOT_PASSWORD_RESET_WEAK_PASSWORD",
      identifier: normalizedEmail || normalizedPhone,
    });

    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });
  }

  try {
    const otpFilter = {
      ...buildIdentifierFilter(identifierPayload),
      context: OTP_CONTEXT.FORGOT_PASSWORD,
    };

    const otpDoc = await OTP.findOne(otpFilter);

    if (!otpDoc || !otpDoc.verified) {
      logger.warn({
        requestId,
        event: "FORGOT_PASSWORD_RESET_NOT_VERIFIED",
        identifier: normalizedEmail || normalizedPhone,
        hasOtpDoc: !!otpDoc,
        isVerified: otpDoc?.verified,
      });

      return res.status(400).json({
        success: false,
        message: "OTP verification required before resetting password",
      });
    }

    const user = await User.findOne({
      role: "shopkeeper",
      ...(normalizedEmail
        ? { email: normalizedEmail }
        : { phone: normalizedPhone }),
    });

    if (!user) {
      logger.error({
        requestId,
        event: "FORGOT_PASSWORD_RESET_USER_NOT_FOUND",
        identifier: normalizedEmail || normalizedPhone,
      });

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.loginAttempts = 0;
    user.loginBlockUntil = null;
    await user.save();

    await OTP.deleteOne({ _id: otpDoc._id });

    logger.info({
      requestId,
      event: "FORGOT_PASSWORD_RESET_SUCCESS",
      userId: user._id,
      identifierType: type,
    });

    if (user.email) {
      try {
        await sendSupplierTemplateMail(
          user.email,
          "password_reset_confirmation",
          {
            "Shopkeeper Name":
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.email,
          }
        );

        logger.info({
          requestId,
          event: "FORGOT_PASSWORD_CONFIRMATION_EMAIL_SENT",
          userId: user._id,
        });
      } catch (emailErr) {
        logger.warn({
          requestId,
          event: "FORGOT_PASSWORD_CONFIRMATION_EMAIL_FAILED",
          userId: user._id,
          error: emailErr.message,
        });
      }
    }

    return res.json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    logger.error({
      requestId,
      event: "FORGOT_PASSWORD_RESET_ERROR",
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    // Save token in blacklist
    await BlacklistedToken.create({ token, expiresAt });

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({ message: "Server error during logout" });
  }
};

exports.deleteShopkeeperByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: "shopkeeper" });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Shopkeeper not found" });
    }

    
    const shop = await Shop.findOne({ owner: user._id });
    if (shop) {
      // Delete shop images
      if (shop.image?.public_id) {
        try {
          await cloudinary.uploader.destroy(shop.image.public_id);
        } catch (err) {
          console.warn("Shop image deletion failed:", err.message);
        }
      }
      if (shop.banner?.public_id) {
        try {
          await cloudinary.uploader.destroy(shop.banner.public_id);
        } catch (err) {
          console.warn("Shop banner deletion failed:", err.message);
        }
      }

      // Delete all products of this shop
      await Product.deleteMany({ shop: shop._id });

      // Delete the shop itself
      await Shop.deleteOne({ _id: shop._id });
    }

    
    if (user?.profile?.public_id) {
      try {
        await cloudinary.uploader.destroy(user.profile.public_id);
      } catch (err) {
        console.warn("Profile image deletion failed:", err.message);
      }
    }

    
    await User.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      message: "Shopkeeper and associated shop/products deleted successfully by admin",
    });
  } catch (error) {
    console.error("Delete Shopkeeper Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//  Update Profile

// exports.shopkeeperLogin = async (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password)
//     return res.status(400).json({ message: 'Email and password are required' });

//   const user = await User.findOne({ email, role: 'shopkeeper' });
//   if (!user) return res.status(404).json({ message: 'Shopkeeper not found' });

//   if (!user.isApproved) {
//     return res.status(403).json({ message: 'Your account is pending admin approval.' });
//   }

//   const isMatch = await bcrypt.compare(password, user.password);
//   if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

//   const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

//   res.json({ success: true, isApproved: true, token });
// };