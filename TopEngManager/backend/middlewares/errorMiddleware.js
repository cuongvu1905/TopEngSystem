function errorHandler(err, req, res, next) {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Lỗi xử lý server nội bộ'
  });
}

module.exports = {
  errorHandler
};
