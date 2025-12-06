const express = require("express");
const {
  createShop,
  getAllShops,
  getShopsByOwner,
  getShopById,
  updateShop,
  deleteShop,
} = require("../controllers/shopController");
const { protect } = require("../middleware/authMiddleware");
const checkShopPayment = require("../middleware/checkshopPayment")
const upload = require("../middleware/upload");

const router = express.Router();

// Create a new shop

router.post(
  "/",
  protect(["shopkeeper"])
,  checkShopPayment,
  upload.fields([
    { name: "imageUrl", maxCount: 1 },
    { name: "bannerUrl", maxCount: 1 },
  ]),
  createShop
);


// Update / Delete  only after payment
router.put(
  "/:id",
  protect(["shopkeeper"]),
  
  upload.fields([
    { name: "imageUrl", maxCount: 1 },
    { name: "bannerUrl", maxCount: 1 },
  ]),
  updateShop
);

router.delete("/:id", protect(["shopkeeper"]),  deleteShop);

// Get shops for owner 
router.get("/owner", protect(["shopkeeper"]), checkShopPayment, getShopsByOwner);

// GET all shops  
router.get("/", getAllShops);
// GET by ID 
router.get("/:id", getShopById);


module.exports = router;