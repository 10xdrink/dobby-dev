exports.successResponse = (res, data, message = "Success") => {
  res.status(200).json({ success: true, message, data });
};

exports.errorResponse = (res, error) => {
  const message = error.message || "Something went wrong";
  res.status(500).json({ success: false, message });
};
