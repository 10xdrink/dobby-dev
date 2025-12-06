const express = require("express")
const { createRole, getRoles, updateRole, toggleRoleStatus, getRoleById } = require("../controllers/employeeroleController")
const router = express.Router()

router.post("/", createRole)
router.get("/", getRoles)
router.get("/:id", getRoleById)
router.put("/:id", updateRole)
router.patch("/:id/status", toggleRoleStatus); 

 




module.exports = router