const mongoose = require("mongoose");
const { Types } = require("mongoose");
const Admin = require("../models/adminLogin");
const Student = require("../models/student");
const { createAndEmitNotification } = require("../helpers/notification");
const { validationResult } = require("express-validator");
const cloudinary = require("../config/cloudinary");

const ReferralClick = require("../models/ReferralClick");
const ReferralHistory = require("../models/ReferralHistory");

const User = require("../models/User");
const Shop = require("../models/Shop");

const { sendSMS } = require("../utils/sms");
const jwt = require("jsonwebtoken");
const BlacklistedToken = require("../models/BlacklistedToken");

const shortid = require("shortid");

const OTP = require("../models/OTPModel");
const OtpSettings = require("../models/OtpSettings");
const { sendOTP, sendEmail } = require("../utils/mailer");

const verifyCaptcha = require("../utils/verifyCaptcha");

// Utility: Delete from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.error("Error deleting file from cloudinary:", error.message);
  }
};

function formatPhone(phone) {
  if (!phone) return null;
  phone = phone.toString().trim();

  if (phone.startsWith("+91")) return phone;
  if (phone.length === 10) return "+91" + phone;
  if (phone.length === 11 && phone.startsWith("0"))
    return "+91" + phone.slice(1);

  return phone;
}

function generateToken(student) {
  return jwt.sign(
    {
      id: student._id,
      role: student.role,
      email: student.email,
      phone: student.phone,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // token expiry
  );
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register Student

exports.registerStudentStep1 = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    let { fullName, email, phone, studentType, schoolname, collegeName } = req.body;

    // Format phone first
    phone = formatPhone(phone);

    if (!fullName || !email || !phone || !studentType) {
      return res
        .status(400)
        .json({ success: false, message: "Basic fields required for step 1" });
    }

    // Validate school or college specific fields
    if (studentType === 'school' && !schoolname) {
      return res.status(400).json({ success: false, message: "School name is required" });
    }
    if (studentType === 'college' && !collegeName) {
      return res.status(400).json({ success: false, message: "College name is required" });
    }

    // Check if student already exists (from OTP login flow)
    let student = await Student.findOne({ $or: [{ email }, { phone }] });
    
    if (student) {
      // Student exists (came from OTP login), update their profile
      console.log(`Updating existing student profile: ${email || phone}`);
      student.fullName = fullName;
      student.phone = phone; // Update phone number
      student.studentType = studentType;
      
      // Update school or college specific fields
      if (studentType === 'school') {
        student.schoolname = schoolname;
      } else if (studentType === 'college') {
        student.collegeName = collegeName;
      }
      
      await student.save();
    } else {
      // New registration, create student
      const studentData = {
        fullName,
        email,
        phone,
        studentType,
        role: "student",
        isActive: false,
      };

      // Add school or college specific fields
      if (studentType === 'school') {
        studentData.schoolname = schoolname;
      } else if (studentType === 'college') {
        studentData.collegeName = collegeName;
      }

      student = await Student.create(studentData);
    }

    res.status(201).json({
      success: true,
      message: "Step 1 complete",
      studentId: student._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.registerStudentStep2 = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    const {
      studentId,
      studentType,
      class: studentClass,
      course,
      year,
      parentName,
      parentPhone,
      address,
    } = req.body;

    // Validate required fields
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }

    // Validate based on student type
    if (studentType === 'school' && !studentClass) {
      return res.status(400).json({ success: false, message: "Class is required for school students" });
    }
    if (studentType === 'college' && (!course || !year)) {
      return res.status(400).json({ success: false, message: "Course and year are required for college students" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Update student type if provided
    if (studentType) student.studentType = studentType;

    // Update class or course/year based on student type
    if (studentType === 'school') {
      student.class = studentClass;
    } else if (studentType === 'college') {
      student.course = course;
      student.year = year;
    }

    // Update optional fields
    if (parentName) student.parentName = parentName;
    if (parentPhone) student.parentPhone = parentPhone;
    if (address) student.address = address;
    student.isActive = true;

    await student.save();

    // Send notification to admin only (not to shopkeepers)
    try {
      await createAndEmitNotification({
        title: "New Student Registered!",
        message: `${student.fullName} from ${student.schoolname} has completed registration.`,
        event: "STUDENT_REGISTERED",
        targetModels: ["Admin"],
        meta: {
          studentId: student._id,
          studentName: student.fullName,
          school: student.schoolname,
          registeredAt: student.createdAt || new Date(),
        },
      });

      console.log(
        `Notification sent to Admin for student registration: ${student.fullName}`
      );
    } catch (notifErr) {
      console.error(
        `Failed to send student registration notification: ${notifErr.message}`
      );
      // Don't fail registration if notification fails
    }

    if (!student.affiliateCode) {
      student.affiliateCode = "STU" + shortid.generate().toUpperCase();
      student.affiliateLink = `${process.env.FRONTEND_PROD}/?form=shopkeeper-register&ref=${student.affiliateCode}`;
      await student.save();
    }

    // Generate token for automatic login (same as customer flow)
    const token = generateToken(student);

    res.status(200).json({
      success: true,
      message: "Student registered successfully",
      token,
      data: student,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get All Students
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find();
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Student By ID
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Student
exports.updateStudent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    const { id } = req.params;

    let student = await Student.findById(id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    const updates = { ...req.body };

    if (req.file && req.file.path) {
      if (student.profilePhotoId) {
        await deleteFromCloudinary(student.profilePhotoId);
      }
      updates.profilePhoto = req.file.path;
      updates.profilePhotoId = req.file.filename;
    }

    student = await Student.findByIdAndUpdate(id, updates, { new: true });

    res
      .status(200)
      .json({ success: true, message: "Student updated", data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Student
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    if (student.profilePhotoId) {
      await deleteFromCloudinary(student.profilePhotoId);
    }

    await Student.findByIdAndDelete(id);

    res
      .status(200)
      .json({ success: true, message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendLoginOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    let { email, phone } = req.body;

    //  if (!captchaToken) {
    //   return res
    //     .status(400)
    //     .json({ message: "captcha is required" });
    // }

    // const captchaOk = await verifyCaptcha(captchaToken);
    //     if (!captchaOk)
    //       return res
    //         .status(400)
    //         .json({ success: false, message: "Captcha verification failed" });

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone is required",
      });
    }

    phone = phone ? formatPhone(phone) : null;

    // Find or create student by email or phone (same as customer flow)
    let student = await Student.findOne({
      $or: [{ email }, { phone }],
    });

    // If student doesn't exist, create a minimal record for OTP verification
    if (!student) {
      console.log(`Creating new student record for OTP login: ${email || phone}`);
      student = new Student({
        email: email || undefined,
        phone: phone || undefined,
        role: 'student',
        isActive: false, // Will be activated after profile completion
      });
      await student.save();
    }

    // Check if existing student is blocked
    if (student.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact admin.",
      });
    }

    const settings = (await OtpSettings.findOne()) || {};
    const resendWait = settings.otpResendTime; // seconds

    const otpExpiryTime = settings.otpExpiryTime || 300; // 5 min default

    let otpDoc;
    let otp = generateOtp();

    if (email) {
      otpDoc = await OTP.findOne({ email, context: 'student_login' });
    } else if (phone) {
      otpDoc = await OTP.findOne({ phone, context: 'student_login' });
    }

    if (!otpDoc) {
      otpDoc = new OTP({
        email: email || null,
        phone: phone || null,
        otp,
        otpExpiry: new Date(Date.now() + otpExpiryTime * 1000),
        attempts: 0,
        context: 'student_login',
        createdAt: new Date(),
      });
      await otpDoc.save();
    } else {
      if (otpDoc.blockUntil && otpDoc.blockUntil > Date.now()) {
        const mins = Math.ceil((otpDoc.blockUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Too many attempts. Try again in ${mins} min`,
        });
      }

      if (Date.now() - otpDoc.createdAt.getTime() < resendWait * 1000) {
        const secs = Math.ceil(
          (resendWait * 1000 - (Date.now() - otpDoc.createdAt.getTime())) / 1000
        );
        return res.status(429).json({
          success: false,
          message: `Please wait ${secs}s before requesting a new OTP`,
        });
      }

      // Update OTP
      otpDoc.otp = otp;
      otpDoc.otpExpiry = new Date(Date.now() + otpExpiryTime * 1000);
      otpDoc.attempts = 0;
      otpDoc.createdAt = new Date();
      otpDoc.blockUntil = null;
      await otpDoc.save();
    }

    // Send OTP
    if (email) await sendOTP(email, otp);
    if (phone) await sendSMS(phone, otp);

    return res.json({
      success: true,
      message: "OTP sent successfully",
      otpExpiryTime,
    });
  } catch (err) {
    console.error("sendLoginOtp error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
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
    const { otp, email, phone } = req.body;
    if (!otp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }

    const settings = (await OtpSettings.findOne()) || {};
    const maxLoginAttempts = settings.maxLoginAttempts || 3;
    const tempLoginBlockTime = settings.tempLoginBlockTime || 21600;

    const otpDoc = await OTP.findOne({ 
      $or: [{ email }, { phone }],
      context: 'student_login'
    });
    if (!otpDoc) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    if (otpDoc.blockUntil && otpDoc.blockUntil > Date.now()) {
      const mins = Math.ceil((otpDoc.blockUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${mins} min`,
      });
    }

    console.log(
      "OTP Expiry Stored:",
      otpDoc.otpExpiry,
      "Current Time:",
      new Date()
    );

    if (!otpDoc.otp || Date.now() > otpDoc.otpExpiry) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    if (otpDoc.attempts >= maxLoginAttempts) {
      otpDoc.blockUntil = new Date(Date.now() + tempLoginBlockTime * 1000);
      await otpDoc.save();
      return res.status(429).json({
        success: false,
        message: "Max OTP attempts exceeded. Try later.",
      });
    }

    if (otp !== otpDoc.otp) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ success: false, message: "Incorrect OTP" });
    }

    await OTP.deleteOne({ _id: otpDoc._id });

    const student = await Student.findOne({
      $or: [{ email: otpDoc.email }, { phone: otpDoc.phone }],
    });

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Only check if blocked (allow inactive students to login for profile completion)
    if (student.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact admin.",
      });
    }

    const token = generateToken(student);

    // Check if student has completed profile (has fullName set during registration)
    const isNewUser = !student.fullName || student.fullName.trim().length === 0;
    
    console.log(`Student ${student.email || student.phone} - isNewUser: ${isNewUser}, hasFullName: ${!!student.fullName}`);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      isNewUser: isNewUser,
      student: {
        _id: student._id,
        id: student._id,
        fullName: student.fullName || '',
        email: student.email,
        phone: student.phone,
        role: student.role,
        studentType: student.studentType,
        // School fields
        schoolname: student.schoolname,
        class: student.class,
        // College fields
        collegeName: student.collegeName,
        course: student.course,
        year: student.year,
      },
    });
  } catch (err) {
    console.error("verifyLoginOtp error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.logoutStudent = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const expiresAt = new Date(decoded.exp * 1000);

    await BlacklistedToken.create({ token, expiresAt });

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReferralSummary = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Student validate
    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Basic counts
    const clicks = await ReferralClick.countDocuments({ studentId });
    const registrations = await User.countDocuments({
      $or: [{ refBy: student.affiliateCode }, { referredBy: student._id }],
    });

    const shopkeepers = await User.find({
      $or: [{ refBy: student.affiliateCode }, { referredBy: student._id }],
    });
    const shopkeeperIds = shopkeepers.map((s) => s._id);

    const activeShops = await Shop.countDocuments({
      owner: { $in: shopkeeperIds },
      status: "active",
    });

    // Conversion Calculation
    const conversionCount = activeShops;
    const conversionRate =
      registrations > 0 ? ((activeShops / registrations) * 100).toFixed(2) : 0;

    // Earnings Aggregation
    const pendingSumAgg = await ReferralHistory.aggregate([
      {
        $match: {
          studentId: new Types.ObjectId(studentId),
          status: "pending",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const pendingEarnings = pendingSumAgg?.[0]?.total || 0;

    const totalEarningsAgg = await ReferralHistory.aggregate([
      {
        $match: {
          studentId: new Types.ObjectId(studentId),
          status: "credited",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalEarnings = totalEarningsAgg?.[0]?.total || 0;

    const pendingReferrals = await ReferralHistory.find({ studentId }).populate(
      "shopkeeperId shopId"
    );

    // Weekly Graph Data (Clicks / Registrations / Conversion)
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);

    // Clicks per day
    const clicksData = await ReferralClick.aggregate([
      {
        $match: {
          studentId: new Types.ObjectId(studentId),
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const registrationsData = await User.aggregate([
      {
        $match: {
          $or: [{ refBy: student.affiliateCode }, { referredBy: student._id }],
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const getDayLabel = (date) => days[new Date(date).getDay()];

    const clicksChart = clicksData.map((d) => ({
      day: getDayLabel(d._id),
      value: d.count,
    }));

    const registrationsChart = registrationsData.map((d) => ({
      day: getDayLabel(d._id),
      value: d.count,
    }));

    const conversionChart = clicksChart.map((clickDay) => {
      const reg =
        registrationsChart.find((r) => r.day === clickDay.day)?.value || 0;
      const rate =
        clickDay.value > 0 ? ((reg / clickDay.value) * 100).toFixed(2) : 0;
      return { day: clickDay.day, value: rate };
    });

    res.json({
      success: true,
      clicks,
      registrations,
      activeShops,
      conversionCount,
      conversionRate: `${conversionRate}%`,
      pendingReferrals,
      pendingEarnings,
      totalEarnings,
      chartData: {
        clicks: clicksChart,
        registrations: registrationsChart,
        conversion: conversionChart,
      },
    });
  } catch (err) {
    console.error("Referral Summary Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// for admin approve status paid or not

exports.approveReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = await ReferralHistory.findById(id).populate({
      path: "shopkeeperId",
      select: "firstName lastName email shopName",
    });
    if (!ref) return res.status(404).json({ message: "Not found" });
    if (ref.status === "credited")
      return res.status(400).json({ message: "Already credited" });

    ref.status = "credited";
    ref.creditedAt = new Date();
    await ref.save();

    await Student.findByIdAndUpdate(ref.studentId, {
      $inc: { totalEarnings: ref.amount },
    });

    const shopkeeperDetails = ref.shopkeeperId;
    const shopkeeperName =
      shopkeeperDetails.firstName && shopkeeperDetails.lastName
        ? `${shopkeeperDetails.firstName} ${shopkeeperDetails.lastName}`.trim()
        : shopkeeperDetails.shopName ||
          (shopkeeperDetails.email
            ? shopkeeperDetails.email.split("@")[0]
            : "a referred shop");

    await createAndEmitNotification({
      title: "Earning Credited! ",
      message: `Your referral earning of ₹${ref.amount} from the shopkeeper ${shopkeeperName} has been successfully credited to your account.`,
      event: "referral-earning-credited",

      targetUsers: [{ userId: ref.studentId, userModel: "Student" }],
      meta: {
        referralId: ref._id,
        amount: ref.amount,
        creditedDate: ref.creditedAt,
        source: "AdminApproval",
      },
    });

    return res.json({
      success: true,
      message: "Referral approved and credited",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAffiliateLink = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!student.affiliateCode) {
      student.affiliateCode = `${student.fullName
        ?.toLowerCase()
        .replace(/\s+/g, "")}-${student._id.toString().slice(-5)}`;
      await student.save();
    }

    const frontendBase =
      process.env.FRONTEND_PROD || "https://yourfrontend.com";

    // Final affiliate link
    const affiliateLink = `${frontendBase}/?form=shopkeeper-register&ref=${student.affiliateCode}`;

    return res.status(200).json({
      success: true,
      affiliateCode: student.affiliateCode,
      affiliateLink,
    });
  } catch (error) {
    console.error("Affiliate link fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching affiliate link",
    });
  }
};

exports.getStudentReferralShops = async (req, res) => {
  try {
    const studentId = req.user.id; // protect middleware should set req.user
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, parseInt(req.query.limit || "10", 10));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status; // optional

    // validate student exists (optional but safe)
    const student = await Student.findById(studentId).select(
      "_id affiliateCode"
    );
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    const match = { studentId: new Types.ObjectId(studentId) };
    if (
      statusFilter &&
      ["pending", "credited", "rejected"].includes(statusFilter)
    ) {
      match.status = statusFilter;
    }

    // Count total
    const total = await ReferralHistory.countDocuments(match);

    // Fetch referral history with populated shop & shopkeeper (most important fields only)
    const referrals = await ReferralHistory.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "shopkeeperId",
        select: "firstName lastName email phone shopName shopAddress isBlocked",
      })
      .populate({
        path: "shopId",
        select: "name location status createdAt image banner owner",
      })
      .lean();

    const items = referrals.map((r) => {
      const shop = r.shopId || {};
      const shopkeeper = r.shopkeeperId || {};

      let location = "";
      if (shop.location) {
        if (typeof shop.location === "string") location = shop.location;
        else if (shop.location.city && shop.location.country)
          location = `${shop.location.city}, ${shop.location.country}`;
        else location = JSON.stringify(shop.location);
      } else if (shop.owner && shopkeeper.shopAddress) {
        location = shopkeeper.shopAddress;
      }

      let shopStatus = "Pending";
      if (shopkeeper.isBlocked || shop.status === "inactive")
        shopStatus = "Inactive";
      else if (r.status === "credited") shopStatus = "Active";

      const earning = {
        amount: r.amount || 0,
        status: r.status || "pending", // pending / credited / rejected
        creditedAt: r.creditedAt || null,
      };

      return {
        referralId: r._id,
        shopId: shop._id || null,
        shopName: shop.name || shop.shopName || shopkeeper.shopName || "—",
        shopkeeperName:
          `${shopkeeper.firstName || ""} ${shopkeeper.lastName || ""}`.trim() ||
          shopkeeper.email ||
          "—",
        location,
        shopCreatedAt: shop.createdAt || r.createdAt, // fallback
        shopStatus,
        earning,
      };
    });

    // Summary counts for student dashboard
    const activeShopsCount = await ReferralHistory.countDocuments({
      studentId: new Types.ObjectId(studentId),
      status: { $in: ["pending", "credited"] },
    });

    const totalEarningsAgg = await ReferralHistory.aggregate([
      {
        $match: {
          studentId: new Types.ObjectId(studentId),
          status: "credited",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalEarnings = totalEarningsAgg?.[0]?.total || 0;

    return res.json({
      success: true,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      summary: {
        totalEarnings,
        activeShopsCount,
      },
      items,
    });
  } catch (err) {
    console.error("getStudentReferralShops error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudentEarningsTable = async (req, res) => {
  try {
    const studentId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    //  Get referrals for  student
    const referrals = await ReferralHistory.find({ studentId })
      .populate({
        path: "shopId",
        select: "shopName shopAddress createdAt status",
      })
      .populate({
        path: "shopkeeperId",
        select: "shopName shopAddress firstName lastName",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formatted = referrals.map((r) => {
      const shop = r.shopId || {};
      const shopkeeper = r.shopkeeperId || {};

      return {
        shopName: shop.shopName || shopkeeper.shopName || "—",
        location: shop.shopAddress || shopkeeper.shopAddress || "—",
        date: new Date(shop.createdAt || r.createdAt).toLocaleDateString(),
        status: r.status === "credited" ? "Completed" : "Pending",
        earning: `₹${r.amount}`,
      };
    });

    const total = await ReferralHistory.countDocuments({ studentId });

    const totalEarnings = await ReferralHistory.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const completedEarnings = await ReferralHistory.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          status: "credited",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const pendingEarnings = await ReferralHistory.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          status: "pending",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const nextPayoutAmount = pendingEarnings[0]?.total || 0;

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      tableData: formatted,
      summary: {
        totalEarnings: totalEarnings[0]?.total || 0,
        completedEarnings: completedEarnings[0]?.total || 0,
        pendingEarnings: pendingEarnings[0]?.total || 0,
        nextPayoutAmount,
      },
    });
  } catch (error) {
    console.error("Error in getStudentEarningsTable:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// for student management in admin panel to show all details of student

exports.getAllStudentsWithReferralStats = async (req, res) => {
  try {
    const students = await Student.aggregate([
      {
        $lookup: {
          from: "referralhistories",
          localField: "_id",
          foreignField: "studentId",
          as: "referrals",
        },
      },
      {
        $addFields: {
          totalReferrals: { $size: "$referrals" },
          totalEarnings: {
            $sum: "$referrals.amount", // sum all credited + pending both
          },
          creditedEarnings: {
            $sum: {
              $map: {
                input: "$referrals",
                as: "r",
                in: {
                  $cond: [{ $eq: ["$$r.status", "credited"] }, "$$r.amount", 0],
                },
              },
            },
          },
          pendingEarnings: {
            $sum: {
              $map: {
                input: "$referrals",
                as: "r",
                in: {
                  $cond: [{ $eq: ["$$r.status", "pending"] }, "$$r.amount", 0],
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          email: 1,
          schoolname: 1,
          affiliateCode: 1,
          totalReferrals: 1,
          totalEarnings: 1,
          creditedEarnings: 1,
          pendingEarnings: 1,
          isActive: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    res.json({
      success: true,
      count: students.length,
      students,
    });
  } catch (err) {
    console.error("getAllStudentsWithReferralStats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudentReferralShopsForAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;

    const referrals = await ReferralHistory.find({ studentId })
      .populate({
        path: "shopkeeperId",
        select: "firstName lastName email phone shopName shopAddress",
      })
      .populate({
        path: "shopId",
        select: "name location status createdAt",
      })
      .sort({ createdAt: -1 })
      .lean();

    const data = referrals.map((r) => {
      const shop = r.shopId || {};
      const shopkeeper = r.shopkeeperId || {};

      return {
        referralId: r._id,
        shopName: shop.name || shopkeeper.shopName || "—",
        shopkeeperName:
          `${shopkeeper.firstName || ""} ${shopkeeper.lastName || ""}`.trim() ||
          shopkeeper.email ||
          "—",
        location:
          typeof shop.location === "string"
            ? shop.location
            : shop.location?.city || shopkeeper.shopAddress || "—",
        createdAt: shop.createdAt || r.createdAt,
        status: r.status || "pending",
        earning: r.amount || 1000,
      };
    });

    res.json({
      success: true,
      count: data.length,
      referrals: data,
    });
  } catch (err) {
    console.error("getStudentReferralShopsForAdmin error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleStudentBlock = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    student.isBlocked = !student.isBlocked;
    student.isActive = !student.isBlocked;
    await student.save();

    res.status(200).json({
      success: true,
      message: `Student has been ${
        student.isBlocked ? "blocked" : "unblocked"
      } successfully`,
      data: {
        id: student._id,
        isBlocked: student.isBlocked,
        isActive: student.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalStudents = await Student.countDocuments();
    const totalSchools = await Student.distinct("schoolname").then(
      (arr) => arr.length
    );
    const totalShops = await Shop.countDocuments({ referredBy: { $ne: null } });

    const blockedStudents = await Student.countDocuments({ isBlocked: true });

    const lastMonthStudents = await Student.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });
    const lastMonthSchools = await Student.distinct("schoolname", {
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    }).then((arr) => arr.length);
    const lastMonthShops = await Shop.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });
    const lastMonthBlocked = await Student.countDocuments({
      isBlocked: true,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    const calcChange = (current, last) => {
      if (last === 0) return current > 0 ? 100 : 0;
      return (((current - last) / last) * 100).toFixed(2);
    };

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalSchools,
        totalShops,
        blockedStudents,
      },
      change: {
        students: calcChange(totalStudents, lastMonthStudents),
        schools: calcChange(totalSchools, lastMonthSchools),
        shops: calcChange(totalShops, lastMonthShops),
        blocked: calcChange(blockedStudents, lastMonthBlocked),
      },
    });
  } catch (err) {
    console.error("Admin dashboard stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};