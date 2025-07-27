// middleware/errorMiddleware.js

// لمعالجة الراوتات غير الموجودة
exports.notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Not Found - ${req.originalUrl}`));
};

// لمعالجة جميع الأخطاء
exports.errorHandler = (err, req, res, next) => {
  console.error('Global Error Handler ->', err.message);

  // أخطاء CORS
  if (err.message && err.message.startsWith('Not allowed by CORS')) {
    return res.status(403).json({
      error: 'CORS blocked.',
      origin: req.headers.origin || null,
      message: err.message
    });
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};