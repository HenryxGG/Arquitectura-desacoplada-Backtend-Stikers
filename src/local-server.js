const http = require("http");
const { URL } = require("url");
const { buildEvent, resolveHandler } = require("./local-router");
const response = require("./utils/response");

process.env.SERVICE_NAME = process.env.SERVICE_NAME || "cromos-backend-cloud-demo";
process.env.STAGE = process.env.STAGE || "dev";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "info";
process.env.APP_VERSION = process.env.APP_VERSION || "1.0.0";

const PORT = Number(process.env.PORT || 3001);
const LOCAL_CLAIMS = {
  "cognito:username": "local-student",
  sub: "local-sub-001",
  email: "student@example.com"
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const bodyChunks = [];

  req.on("data", (chunk) => bodyChunks.push(chunk));
  req.on("end", async () => {
    const route = resolveHandler(req.method, requestUrl.pathname);

    if (!route) {
      const result = response.notFound(`No existe la ruta ${req.method} ${requestUrl.pathname}`);
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }

    const event = buildEvent(
      req.method,
      requestUrl.pathname,
      Object.fromEntries(requestUrl.searchParams.entries()),
      bodyChunks.length > 0 ? Buffer.concat(bodyChunks).toString("utf8") : null,
      LOCAL_CLAIMS
    );

    const result = await route.handler(event);
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor local escuchando en http://localhost:${PORT}`);
});

