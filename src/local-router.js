const root = require("./handlers/root");
const health = require("./handlers/health");
const countries = require("./handlers/countries");
const teams = require("./handlers/teams");
const players = require("./handlers/players");
const stickers = require("./handlers/stickers");

const routes = [
  { method: "GET", pattern: /^\/$/, handler: root.lambdaHandler },
  { method: "OPTIONS", pattern: /^\/$/, handler: root.lambdaHandler },
  { method: "GET", pattern: /^\/health$/, handler: health.lambdaHandler },
  { method: "OPTIONS", pattern: /^\/health$/, handler: health.lambdaHandler },
  { method: "GET", pattern: /^\/countries$/, handler: countries.lambdaHandler },
  { method: "OPTIONS", pattern: /^\/countries$/, handler: countries.lambdaHandler },
  { method: "GET", pattern: /^\/countries\/([^/]+)$/, handler: countries.lambdaHandler, pathParamNames: ["id"] },
  { method: "OPTIONS", pattern: /^\/countries\/([^/]+)$/, handler: countries.lambdaHandler, pathParamNames: ["id"] },
  { method: "GET", pattern: /^\/teams$/, handler: teams.lambdaHandler },
  { method: "OPTIONS", pattern: /^\/teams$/, handler: teams.lambdaHandler },
  { method: "GET", pattern: /^\/teams\/([^/]+)$/, handler: teams.lambdaHandler, pathParamNames: ["id"] },
  { method: "OPTIONS", pattern: /^\/teams\/([^/]+)$/, handler: teams.lambdaHandler, pathParamNames: ["id"] },
  { method: "GET", pattern: /^\/players$/, handler: players.lambdaHandler },
  { method: "OPTIONS", pattern: /^\/players$/, handler: players.lambdaHandler },
  { method: "GET", pattern: /^\/players\/([^/]+)$/, handler: players.lambdaHandler, pathParamNames: ["id"] },
  { method: "OPTIONS", pattern: /^\/players\/([^/]+)$/, handler: players.lambdaHandler, pathParamNames: ["id"] },
  { method: "GET", pattern: /^\/stickers$/, handler: stickers.lambdaHandler },
  { method: "POST", pattern: /^\/stickers$/, handler: stickers.lambdaHandler },
  { method: "OPTIONS", pattern: /^\/stickers$/, handler: stickers.lambdaHandler },
  { method: "GET", pattern: /^\/stickers\/([^/]+)$/, handler: stickers.lambdaHandler, pathParamNames: ["id"] },
  { method: "PUT", pattern: /^\/stickers\/([^/]+)$/, handler: stickers.lambdaHandler, pathParamNames: ["id"] },
  { method: "DELETE", pattern: /^\/stickers\/([^/]+)$/, handler: stickers.lambdaHandler, pathParamNames: ["id"] },
  { method: "OPTIONS", pattern: /^\/stickers\/([^/]+)$/, handler: stickers.lambdaHandler, pathParamNames: ["id"] }
];

function buildEvent(method, path, queryStringParameters = {}, body = null, claims = {}) {
  const route = routes.find((candidate) => candidate.method === method && candidate.pattern.test(path));

  if (!route) {
    return {
      httpMethod: method,
      path,
      queryStringParameters,
      body,
      pathParameters: {}
    };
  }

  const match = path.match(route.pattern);
  const pathParameters = {};

  (route.pathParamNames || []).forEach((name, index) => {
    pathParameters[name] = match[index + 1];
  });

  return {
    httpMethod: method,
    path,
    queryStringParameters,
    body,
    pathParameters,
    requestContext: {
      authorizer: {
        claims
      }
    }
  };
}

function resolveHandler(method, path) {
  return routes.find((candidate) => candidate.method === method && candidate.pattern.test(path));
}

module.exports = {
  buildEvent,
  resolveHandler
};

