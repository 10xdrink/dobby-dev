const express = require("express");
const { loginEmployee, getProfile, updateProfile, logoutEmployee } = require("../controllers/employeeauthController");
const upload = require("../middleware/upload")
const {employeeMiddleware} = require("../middleware/employeeMiddleware")


const router = express.Router();

router.post("/login", loginEmployee);
router.post("/logout", employeeMiddleware, logoutEmployee);

router.get("/profile", employeeMiddleware, getProfile);
router.put("/profile", employeeMiddleware, upload.single("employeeImage"), updateProfile);


module.exports = router;
