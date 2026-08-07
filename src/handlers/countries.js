const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLA_CROMOS;

const { getCountryFlag } = require("../data/images");
const logger = require("../utils/logger");
const response = require("../utils/response");
const { getMethod, getPath } = require("../utils/http");
const { parseJsonBody } = require("../utils/request");
const { getAuthenticatedUser } = require("../utils/cognito");
const { useLocalData, getStaticCountries } = require("../utils/local-data");

function enrichCountry(country) {
  return {
    ...country,
    flag: country.flag || getCountryFlag(country.id) || country.banderaEmoji || null
  };
}

function validateCountryPayload(payload) {
  const missing = ["name", "continent"].filter((f) => !payload[f]);
  if (missing.length > 0) return `Faltan campos obligatorios: ${missing.join(", ")}`;
  return null;
}

async function lambdaHandler(event) {
  logger.logRequest(event);

  try {
    const method = getMethod(event);
    const path   = getPath(event);
    const user   = getAuthenticatedUser(event);

    if (method === "OPTIONS") return response.options();

    let result;

    if (useLocalData()) {
      const countries = getStaticCountries();

      if (method === "GET" && path === "/countries") {
        result = response.ok({ items: countries.map(enrichCountry), count: countries.length });

      } else if (method === "GET" && event.pathParameters?.id) {
        const country = countries.find((c) => c.id === event.pathParameters.id);
        result = country
          ? response.ok(enrichCountry(country))
          : response.notFound(`No se encontró el país con id '${event.pathParameters.id}'`);

      } else if (method === "POST" && path === "/countries") {
        const payload = parseJsonBody(event.body);
        if (!payload) return response.badRequest("El body no contiene JSON válido");
        const err = validateCountryPayload(payload);
        if (err) return response.badRequest(err);

        const newId = payload.id || `country-${Date.now()}`;
        const newCountry = {
          PK: `COUNTRY#${newId}`, SK: "METADATA", type: "COUNTRY", id: newId,
          name: payload.name, continent: payload.continent,
          fifaCode: payload.fifaCode || null,
          fifaRanking: payload.fifaRanking ? Number(payload.fifaRanking) : null,
          flag: payload.flag || null,
        };
        result = response.created({
          message: "País creado en modo local (datos no persistidos)",
          requestedBy: user.username,
          item: enrichCountry(newCountry)
        });

      } else {
        result = response.notFound(`No existe la ruta ${method} ${path}`);
      }

    } else {
      if (method === "GET" && path === "/countries") {
        const scanCommand = new ScanCommand({ TableName: TABLE_NAME });
        const dbResponse  = await dynamo.send(scanCommand);
        // ── Filtrar SOLO items de tipo COUNTRY ─────────────────────────────
        const items = (dbResponse.Items || []).filter(
          (i) => i.type === "COUNTRY" || i.PK?.startsWith("COUNTRY#")
        );
        result = response.ok({ items: items.map(enrichCountry), count: items.length });

      } else if (method === "GET" && event.pathParameters?.id) {
        const countryId  = event.pathParameters.id;
        const getCommand = new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `COUNTRY#${countryId}`, SK: "METADATA" }
        });
        const dbResponse = await dynamo.send(getCommand);
        const country    = dbResponse.Item;
        result = country
          ? response.ok(enrichCountry(country))
          : response.notFound(`No se encontró el país con id '${countryId}'`);

      } else if (method === "POST" && path === "/countries") {
        const payload = parseJsonBody(event.body);
        if (!payload) return response.badRequest("El body no contiene JSON válido");
        const err = validateCountryPayload(payload);
        if (err) return response.badRequest(err);

        const newId = payload.id || `country-${Date.now()}`;
        const newCountry = {
          PK: `COUNTRY#${newId}`, SK: "METADATA", type: "COUNTRY", id: newId,
          name: payload.name, continent: payload.continent,
          fifaCode: payload.fifaCode || null,
          fifaRanking: payload.fifaRanking ? Number(payload.fifaRanking) : null,
          flag: payload.flag || null,
        };

        await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newCountry }));

        result = response.created({
          message: "País creado en DynamoDB",
          requestedBy: user.username,
          item: enrichCountry(newCountry)
        });

      } else {
        result = response.notFound(`No existe la ruta ${method} ${path}`);
      }
    }

    logger.logResult({ route: path, method, statusCode: result.statusCode, username: user.username });
    return result;
  } catch (error) {
    logger.logError(error, event);
    return response.internalServerError();
  }
}

module.exports = { lambdaHandler };
