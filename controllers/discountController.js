const createError = require('http-errors');
const Discount = require('../models/Discount');

async function listDiscounts(req, res) {
  const { q, active, page = 1, limit = 20 } = req.query;
  const filter = { isDeleted: false };

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const docs = await Discount.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
  const total = await Discount.countDocuments(filter);

  let items = docs;
  if (active === 'true' || active === 'false') {
    items = docs.filter(d => d.isActive === (active === 'true'));
  }

  res.json({ page: Number(page), limit: Number(limit), total, count: items.length, items });
}

async function getDiscount(req, res, next) {
  const doc = await Discount.findOne({ _id: req.params.id, isDeleted: false });
  if (!doc) return next(createError(404, 'Discount not found'));
  res.json(doc);
}

async function createDiscount(req, res) {
  if (req.body.usageLimit === '') req.body.usageLimit = null;
  const discount = await Discount.create(req.body);
  res.status(201).json(discount);
}

async function updateDiscount(req, res, next) {
  if (req.body.usageLimit === '') req.body.usageLimit = null;
  const updated = await Discount.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!updated) return next(createError(404, 'Discount not found'));
  res.json(updated);
}

async function deleteDiscount(req, res, next) {
  const removed = await Discount.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!removed) return next(createError(404, 'Discount not found'));
  res.status(204).send();
}

module.exports = {
  listDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount
};
