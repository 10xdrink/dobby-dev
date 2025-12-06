const express = require("express");
const router = express.Router();

const {
  getCustomersList,
  getCustomerStats,
  getSingleCustomer,
  getViewOrders,
  getCustomerProfile,
  sendMessageToCustomer,
  deactivateCustomerForShop,
} = require("../controllers/shopCustomerController");
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");

router.get("/", protect(["shopkeeper"]), checkActiveShop, getCustomersList);

router.get(
  "/stats",
  protect(["shopkeeper"]),
  checkActiveShop,
  getCustomerStats
);

router.get(
  "/:customerId",
  protect(["shopkeeper"]),
  checkActiveShop,
  getSingleCustomer
);

router.get(
  "/customer/:customerId/orders",
  protect(["shopkeeper"]),
  checkActiveShop,
  getViewOrders
);

router.get(
  "/:customerId/profile",
  protect(["shopkeeper"]),
  checkActiveShop,
  getCustomerProfile
);

router.post(
  "/customer/:customerId/send-message",
  protect(["shopkeeper"]),
  checkActiveShop,
  sendMessageToCustomer
);

router.patch("/:customerId/deactivate", protect(["shopkeeper"]), checkActiveShop, deactivateCustomerForShop);



module.exports = router;
