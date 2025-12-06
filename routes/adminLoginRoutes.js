const express = require('express');
const router = express.Router();

const upload = require("../middleware/upload");
const {protect} = require('../middleware/adminMiddleware');
const { adminLogin, adminLogout, forgotPassword, verifyOtp, resetPassword, getAdminProfile, updateAdminProfile, changePassword } = require('../controllers/adminLoginController');

router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password',resetPassword);
router.get('/profile', protect(), getAdminProfile);
router.put("/change-password", protect(), changePassword);
router.put("/update-profile", protect(), upload.single("profilePhoto"), updateAdminProfile);


router.get('/dashboard', protect(), (req, res) => {
  res.json({ success:true, message: 'Welcome admin', user: req.user });
});


module.exports = router;
