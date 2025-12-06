const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createDiscountSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().nonnegative(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  minPurchaseAmount: z.number().nonnegative().nullable().optional(),
  applicableProducts: z.array(z.string().regex(objectIdRegex)).optional().default([])
});

const updateDiscountSchema = createDiscountSchema.partial();

module.exports = { createDiscountSchema, updateDiscountSchema };
