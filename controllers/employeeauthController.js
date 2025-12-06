const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee");

const cloudinary = require("../config/cloudinary"); 
const BlacklistedToken = require("../models/BlacklistedToken");

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Error deleting old file:", err.message);
  }
};


exports.loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    
    const normalizedEmail = email.trim().toLowerCase();

    //  employee exist
    const employee = await Employee.findOne({ email: normalizedEmail }).populate(
      "role",
      "roleName permissions status"
    );

    if (!employee) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    //  if employee blocked
    if (!employee.status) {
      return res.status(403).json({ success: false, message: "Your account is blocked. Contact admin." });
    }

    //  if role active hai
    if (!employee.role || !employee.role.status) {
      return res.status(403).json({ success: false, message: "Role is inactive. Contact admin." });
    }

    //  password
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    // JWT token with role + permissions
    const token = jwt.sign(
      {
        id: employee._id,
        role: employee.role.roleName,
        permissions: employee.role.permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      employee: {
        id: employee._id,
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role.roleName,
        permissions: employee.role.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const employeeId = req.employee.id;

    const employee = await Employee.findById(employeeId).select(
      "fullName email phone employeeImage"
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.json({ success: true, employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { newPassword, confirmPassword } = req.body;
    const updateData = {};

    // Password change
    if (newPassword || confirmPassword) {
      if (!newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Both new password and confirm password are required.",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match." });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Profile image update
    if (req.file) {
      const employee = await Employee.findById(employeeId);

      if (employee.employeeImagePublicId) {
        await deleteFromCloudinary(employee.employeeImagePublicId);
      }

      updateData.employeeImage = req.file.path;
      updateData.employeeImagePublicId = req.file.filename;
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(employeeId, updateData, {
      new: true,
    }).select("fullName email phone employeeImage");

    res.json({
      success: true,
      message: "Profile updated successfully.",
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.logoutEmployee = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Decode token to extract expiry time
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Save token to blacklist
    await BlacklistedToken.create({
      token,
      expiresAt: new Date(decoded.exp * 1000), 
    });

    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    console.error("Logout error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

