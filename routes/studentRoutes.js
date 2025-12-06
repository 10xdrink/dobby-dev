const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect } = require("../middleware/authMiddleware");
const {
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  registerStudentStep1,
  registerStudentStep2,
  sendLoginOtp,
  verifyLoginOtp,
  logoutStudent,
  getReferralSummary,
  approveReferral,
  getStudentReferralShops,
  getStudentEarningsTable,
  getAllStudentsWithReferralStats,
  getStudentReferralShopsForAdmin,
  getAffiliateLink,
  toggleStudentBlock,
  getStudentDashboardStats,
} = require("../controllers/studentController");
const { validate } = require("../middleware/validate");
const { registerStep1, registerStep2, sendLogin, verifyLogin, updateStu } = require("../validators/studentValidator");


router.post("/", registerStep1 , validate, registerStudentStep1);
router.post("/step2", registerStep2 , validate, registerStudentStep2);
router.post("/send-otp", sendLogin, validate, sendLoginOtp);
router.post("/verify-otp", verifyLogin, validate , verifyLoginOtp);

router.get("/", protect(["student"]), getStudents);
router.get("/student/:id", protect(["student"]), getStudentById);

router.put(
  "/update/:id",
  updateStu,
  validate,
  protect(["student"]),
  upload.single("profilePhoto"),
  updateStudent
);
router.delete("/delete/:id", deleteStudent);

router.post("/logout", protect(["student"]), logoutStudent);

router.get("/referral", protect(["student"]),  getReferralSummary);

// for admin approval whether status credited or not of student earning

router.put("/admin/referrals/:id/approve", approveReferral);

// for shop management in studnet panel

router.get("/shops", protect(["student"]), getStudentReferralShops);

// for earning management in student panel

router.get("/earnings", protect(["student"]),  getStudentEarningsTable);

router.get("/admin/all-students",  getAllStudentsWithReferralStats);

router.get("/admin/students/:studentId", getStudentReferralShopsForAdmin);

router.get("/affiliate-link", protect(["student"]),  getAffiliateLink);

// stduent block by admin 

router.get("/admin/students/:id/block", toggleStudentBlock)

// for admin to show stduent stats

router.get("/admin/stats",  getStudentDashboardStats)

module.exports = router;