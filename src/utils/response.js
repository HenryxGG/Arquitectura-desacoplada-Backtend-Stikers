const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Content-Type": "application/json"
};

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

function ok(payload) {
  return json(200, payload);
}

function created(payload) {
  return json(201, payload);
}

function badRequest(message, details) {
  return json(400, {
    error: "Bad Request",
    message,
    details
  });
}

function notFound(message) {
  return json(404, {
    error: "Not Found",
    message
  });
}

function internalServerError(message = "Ocurrió un error interno del servidor") {
  return json(500, {
    error: "Internal Server Error",
    message
  });
}

function options() {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      message: "CORS preflight OK"
    })
  };
}

module.exports = {
  CORS_HEADERS,
  json,
  ok,
  created,
  badRequest,
  notFound,
  internalServerError,
  options
};
