function errorHandler(err, req, res, _next) {
  console.error("Error:", err.message);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, error: messages });
  }

  if (err.code === 11000) {
    return res.status(400).json({ success: false, error: "Duplicate entry" });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ success: false, error: "Invalid ID format" });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
}

module.exports = errorHandler;
