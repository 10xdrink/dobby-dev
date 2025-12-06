const express = require("express");
const { addEmployee, getEmployees, getEmployeeById, updateEmployee, toggleEmployeeStatus, deleteEmployee } = require("../controllers/employeeController");
const upload = require("../middleware/upload")
const { protect } = require("../middleware/adminMiddleware");
const router = express.Router();


router.post(
  "/",
  upload.fields([
    { name: "employeeImage", maxCount: 1 },
    { name: "identityImage", maxCount: 1 }
  ]),
  addEmployee
);

router.get("/",  getEmployees);
router.get("/:id",  getEmployeeById);
router.put(
  "/:id",
  upload.fields([
    { name: "employeeImage", maxCount: 1 },
    { name: "identityImage", maxCount: 1 }
  ]),
  updateEmployee
);
router.patch("/:id/toggle-status",  toggleEmployeeStatus);
router.delete("/:id", protect(), deleteEmployee);

module.exports = router;
