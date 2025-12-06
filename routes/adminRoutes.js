const express = require('express');
const router = express.Router();
const { 
  getAllShopkeepers, 
  approveShopkeeper, 
  rejectShopkeeper,
  toggleBlockShopkeeper,
  deleteShopkeeper
} = require('../controllers/adminController');
const jwt = require('jsonwebtoken');

const allowAdminOrEmployee = (req, res, next) => {
  const token =
    req.cookies?.adminToken ||
    (req.headers.authorization?.startsWith("Bearer ") &&
      req.headers.authorization.split(" ")[1]);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role && typeof decoded.role === 'object' && decoded.permissions) {
       req.employee = decoded; 
       return next();
    }
    
    req.user = decoded;
    return next();

  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

router.get('/shopkeepers', getAllShopkeepers);
router.put('/shopkeepers/:id/approve', approveShopkeeper);
router.put('/shopkeepers/:id/reject', rejectShopkeeper);
router.put('/shopkeepers/:id/toggle-block', allowAdminOrEmployee, toggleBlockShopkeeper);
router.delete('/shopkeepers/:id', allowAdminOrEmployee, deleteShopkeeper);

module.exports = router;
