const express = require('express');
const router = express.Router();

const {
  listDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount
} = require('../controllers/discountController');

const { validateBody } = require('../middleware/validateRequest');
const { createDiscountSchema, updateDiscountSchema } = require('../validators/discountSchemas');

router.route('/')
  .get(listDiscounts)
  .post(validateBody(createDiscountSchema), createDiscount);

router.route('/:id')
  .get(getDiscount)
  .patch(validateBody(updateDiscountSchema), updateDiscount)
  .delete(deleteDiscount);

module.exports = router;
