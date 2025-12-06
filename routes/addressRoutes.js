const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { addAddress, getAddresses, updateAddress, deleteAddress, addGuestAddress, getGuestAddresses, updateGuestAddress, deleteGuestAddress, mergeGuestAddresses } = require("../controllers/addressController");
const { addAddressValidation, addressIdValidation, sessionIdQueryValidation } = require("../validators/addressValidator");
const { validate } = require("../middleware/validate");
const { cacheByUser, invalidateCache } = require("../middleware/cacheMiddleware");

const invalidateUserCache = (req) => `user:${req.user._id}:*`;
const invalidateGuestCache = (req) => req.query.sessionId ? `user:guest:*${req.query.sessionId}*` : null;

// loggedin customer

router.post("/", protect(["customer", "student"]), addAddressValidation, validate , invalidateCache(invalidateUserCache), addAddress);
router.get("/", protect(["customer", "student"]), cacheByUser(), getAddresses);
router.put("/:id", protect(["customer", "student"]), addressIdValidation, addAddressValidation, validate, invalidateCache(invalidateUserCache), updateAddress);
router.delete("/:id", protect(["customer", "student"]), addressIdValidation, validate, invalidateCache(invalidateUserCache), deleteAddress);

// guest customer

router.post("/guest", sessionIdQueryValidation, addAddressValidation, validate , invalidateCache(invalidateGuestCache), addGuestAddress);
router.get("/guest", cacheByUser(), getGuestAddresses);
router.put("/guest/:id", sessionIdQueryValidation, addressIdValidation, addAddressValidation, validate, invalidateCache(invalidateGuestCache), updateGuestAddress);
router.delete("/guest/:id",  sessionIdQueryValidation, addressIdValidation, validate,  invalidateCache(invalidateGuestCache), deleteGuestAddress);

// Merge guest addresses after login
router.post("/merge-guest", protect(["customer", "student"]), sessionIdQueryValidation, validate, invalidateCache(invalidateUserCache), invalidateCache(invalidateGuestCache), mergeGuestAddresses);



module.exports = router;
