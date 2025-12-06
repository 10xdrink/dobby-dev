// paras mourya 
const express = require('express');
const { getFaq, getFaqById, createFaq, updateFaq, deleteFaq } = require('../controllers/faqController');
const router = express.Router();

router.get("/", getFaq);
router.get("/:id", getFaqById);
router.post("/", createFaq);
router.put("/:id", updateFaq);
router.delete("/:id", deleteFaq);

module.exports = router;
