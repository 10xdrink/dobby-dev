const express = require('express');
const { getAllFaqs, createFaq, updateFaq, deleteFaq, getPublishedFaqs } = require('../controllers/studentfaqController');
const router = express.Router();


router.get('/', getAllFaqs);               
router.post('/', createFaq);              
router.put('/:id', updateFaq);            
router.delete('/:id', deleteFaq);         


router.get('/published', getPublishedFaqs);  

module.exports = router;
