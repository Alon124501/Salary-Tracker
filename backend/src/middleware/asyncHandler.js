// Wraps an async route handler so any unhandled rejection is forwarded to next(err),
// which lands in the global error handler in app.js instead of crashing the process.
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
