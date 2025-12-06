const express = require("express");
const {
  createRole,
  getRoles,
  updateRole,
  deleteRole,
} = require("../controllers/roleController");

const router = express.Router();

router.post("/", createRole);
router.get("/", getRoles);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

module.exports = router;
