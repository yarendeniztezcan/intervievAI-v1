function errorHandler(err, req, res, next) {
  console.error('Sunucu hatası:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Sunucu hatası oluştu'
  });
}

module.exports = errorHandler;
