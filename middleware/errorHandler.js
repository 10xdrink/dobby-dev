function errorHandler(err, req, res, next) {
  console.error(err);

  if (err?.code === 11000) {
    return res.status(409).json({ message: 'Duplicate key', details: err.keyValue });
  }

  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]))
    });
  }

  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
}

module.exports = { errorHandler };
