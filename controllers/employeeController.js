const bcrypt = require("bcrypt");
const Employee = require("../models/Employee");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose")
const EmployeeRole = require("../models/EmployeeRole");

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Error deleting old file:", err.message);
  }
};

// Add Employee
exports.addEmployee = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    const {
      fullName,
      phone,
      role,
      identityType,
      identityNumber,
      email,
      password,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(role)) {
      return res.status(400).json({ success: false, message: "Invalid Role ID" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = new Employee({
      fullName,
      phone,
      role,
      identityType,
      identityNumber,
      email,
      password: hashedPassword,
      employeeImage: req.files?.employeeImage?.[0]?.path || "",
      employeeImagePublicId: req.files?.employeeImage?.[0]?.filename || "",
      identityImage: req.files?.identityImage?.[0]?.path || "",
      identityImagePublicId: req.files?.identityImage?.[0]?.filename || "",
    });

    await employee.save();

    res.status(201).json({ success: true, message: "Employee created", employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Employees (with Role + Permissions populated)
exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().populate(
      "role",
      "roleName permissions status"
    );

    res.json({ success: true, employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle Employee Status
exports.toggleEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);

    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });

    employee.status = !employee.status;
    await employee.save();

    res.json({ success: true, message: "Employee status updated", employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Employee
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const updateData = { ...req.body };

    // Password rehash
    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 10);
    }

    
    if (req.files?.employeeImage?.[0]) {
      if (employee.employeeImagePublicId) {
        await deleteFromCloudinary(employee.employeeImagePublicId);
      }
      updateData.employeeImage = req.files.employeeImage[0].path;
      updateData.employeeImagePublicId = req.files.employeeImage[0].filename;
    }


    if (req.files?.identityImage?.[0]) {
      if (employee.identityImagePublicId) {
        await deleteFromCloudinary(employee.identityImagePublicId);
      }
      updateData.identityImage = req.files.identityImage[0].path;
      updateData.identityImagePublicId = req.files.identityImage[0].filename;
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(id, updateData, { new: true });

    res.json({ success: true, message: "Employee updated", updatedEmployee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Employee (with Role details)
exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id).populate(
      "role",
      "roleName permission status"
    );

    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });

    res.json({ success: true, employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Employee
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Delete images from Cloudinary
    if (employee.employeeImagePublicId) {
      await deleteFromCloudinary(employee.employeeImagePublicId);
    }
    if (employee.identityImagePublicId) {
      await deleteFromCloudinary(employee.identityImagePublicId);
    }

    await Employee.findByIdAndDelete(id);

    res.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
