function getMethod(event) {
  return event.httpMethod || event.requestContext?.http?.method || "GET";
}

function getPath(event) {
  return event.path || event.rawPath || "/";
}

module.exports = {
  getMethod,
  getPath
};

