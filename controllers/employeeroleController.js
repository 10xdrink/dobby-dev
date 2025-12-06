const EmployeeRole = require("../models/EmployeeRole");

exports.createRole = async (req, res) => {
  try {
    const { roleName, permissions } = req.body;

    const newRole = new EmployeeRole({ roleName, permissions });
    await newRole.save();

    res.status(201).json({
      success: true,
      message: "EmployeeRole created successfully",
      role: newRole,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//  Get All Roles
exports.getRoles = async (req, res) => {
  try {
    const roles = await EmployeeRole.find();
    res.json({ success: true, roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//  Update EmployeeRole (permissions or name)
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, permissions } = req.body;

    const updatedRole = await EmployeeRole.findByIdAndUpdate(
      id,
      { roleName, permissions },
      { new: true }
    );

    if (!updatedRole)
      return res
        .status(404)
        .json({ success: false, message: "EmployeeRole not found" });

    res.json({ success: true, message: "EmployeeRole updated", updatedRole });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//  Toggle EmployeeRole Status (block/unblock)
exports.toggleRoleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await EmployeeRole.findById(id);

    if (!role)
      return res
        .status(404)
        .json({ success: false, message: "EmployeeRole not found" });

    role.status = !role.status;
    await role.save();

    res.json({ success: true, message: "role status updated", role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single EmployeeRole (for View)
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await EmployeeRole.findById(id);

    if (!EmployeeRole)
      return res
        .status(404)
        .json({ success: false, message: "role not found" });

    res.json({ success: true, role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
