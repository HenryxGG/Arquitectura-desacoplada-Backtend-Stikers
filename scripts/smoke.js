const { buildEvent, resolveHandler } = require("../src/local-router");

process.env.SERVICE_NAME = process.env.SERVICE_NAME || "cromos-backend-cloud-demo";
process.env.STAGE = process.env.STAGE || "dev";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "info";
process.env.APP_VERSION = process.env.APP_VERSION || "1.0.0";

const CLAIMS = {
  "cognito:username": "smoke-user",
  sub: "smoke-sub-001",
  email: "smoke@example.com"
};

async function invoke(method, path, body = null) {
  const [rawPath, queryString] = path.split("?");
  const queryStringParameters = queryString
    ? Object.fromEntries(new URLSearchParams(queryString).entries())
    : {};
  const route = resolveHandler(method, rawPath);

  if (!route) {
    throw new Error(`No existe handler para ${method} ${rawPath}`);
  }

  const event = buildEvent(method, rawPath, queryStringParameters, body, CLAIMS);
  return route.handler(event);
}

async function main() {
  const routes = [
    ["GET", "/"],
    ["GET", "/health"],
    ["GET", "/countries"],
    ["GET", "/teams/ecuador-national-team"],
    ["GET", "/players?country=ecuador"],
    ["GET", "/stickers/sticker-001"],
    [
      "POST",
      "/stickers",
      JSON.stringify({
        number: "099",
        playerId: "moises-caicedo",
        edition: "Test Edition",
        rarity: "special"
      })
    ],
    [
      "PUT",
      "/stickers/sticker-001",
      JSON.stringify({
        edition: "Collector Update",
        collected: false
      })
    ],
    ["DELETE", "/stickers/sticker-001"]
  ];

  for (const [method, path, body] of routes) {
    const result = await invoke(method, path, body || null);
    console.log(method, path, result.statusCode);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
