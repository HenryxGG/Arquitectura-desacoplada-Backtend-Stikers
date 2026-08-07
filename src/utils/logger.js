const { getAuthenticatedUser } = require("./cognito");
const { getMethod, getPath } = require("./http");

function baseLog(level, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME,
    stage: process.env.STAGE,
    domain: process.env.DOMAIN_NAME,
    ...data
  };

  console.log(JSON.stringify(entry));
}

function logRequest(event) {
  const user = getAuthenticatedUser(event);

  baseLog("INFO", {
    message: "Inicio de petición",
    route: getPath(event),
    method: getMethod(event),
    pathParameters: event.pathParameters || {},
    queryStringParameters: event.queryStringParameters || {},
    username: user.username,
    cognitoSub: user.sub
  });
}

function logResult(data) {
  baseLog("INFO", {
    message: "Resultado de petición",
    ...data
  });
}

function logError(error, event) {
  baseLog("ERROR", {
    message: error.message,
    route: getPath(event),
    method: getMethod(event),
    stack: error.stack
  });
}

module.exports = {
  logRequest,
  logResult,
  logError
};

