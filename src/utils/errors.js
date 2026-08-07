class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function badRequest(message, details = null) {
  return new AppError(message, 400, details);
}

function notFound(message) {
  return new AppError(message, 404);
}

module.exports = {
  AppError,
  badRequest,
  notFound
};

