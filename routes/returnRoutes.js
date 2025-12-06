
const express = require('express');
const router = express.Router();



const { protect } = require('../middleware/authMiddleware');
const checkActiveShop = require('../middleware/checkActiveShop');
const { createReturnRequest, getCustomerReturnRequests, getReturnRequestById, getShopReturnRequests, updateReturnRequestStatus } = require('../controllers/returnrequestController');


router.post(
  '/create',
  protect(['customer']),
  createReturnRequest
);

router.get(
  '/my-requests',
  protect(['customer']),
  getCustomerReturnRequests
);

router.get(
  '/customer/:id',
  protect(['customer']),
  getReturnRequestById
);


router.get(
  '/shop/requests',
  protect(['shopkeeper']),
  checkActiveShop,
  getShopReturnRequests
);

router.patch(
  '/shop/update-status',
  protect(['shopkeeper']),
  checkActiveShop,
  updateReturnRequestStatus
);

router.get(
  '/shop/:id',
  protect(['shopkeeper']),
  checkActiveShop,
  getReturnRequestById
);

module.exports = router;