const logger = require("../utils/logger");
const response = require("../utils/response");
const { getMethod, getPath } = require("../utils/http");

async function lambdaHandler(event) {
  logger.logRequest(event);

  try {
    const method = getMethod(event);
    const path = getPath(event);

    if (method === "OPTIONS") {
      return response.options();
    }

    if (method === "GET" && path === "/health") {
      const result = response.ok({
        status: "ok",
        service: process.env.SERVICE_NAME
      });

      logger.logResult({ route: path, method, statusCode: result.statusCode });
      return result;
    }

    const result = response.notFound(`No existe la ruta ${method} ${path}`);
    logger.logResult({ route: path, method, statusCode: result.statusCode });
    return result;
  } catch (error) {
    logger.logError(error, event);
    return response.internalServerError();
  }
}

module.exports = {
  lambdaHandler
};

