const Role = require("../models/Role");

exports.createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const role = new Role({ name, permissions });
    await role.save();
    res.json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRoles = async (req, res) => {
  const roles = await Role.find();
  res.json(roles);
};

exports.updateRole = async (req, res) => {
  try {
    const { name, permissions, isActive } = req.body;
    const role = await Role.findByIdAndUpdate(
      req.params.id,
      { name, permissions, isActive },
      { new: true }
    );
    res.json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  await Role.findByIdAndDelete(req.params.id);
  res.json({ message: "Role deleted" });
};
