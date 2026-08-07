const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLA_CROMOS;

const { getTeamImage } = require("../data/images");
const logger = require("../utils/logger");
const response = require("../utils/response");
const { getMethod, getPath } = require("../utils/http");
const { parseJsonBody } = require("../utils/request");
const { getAuthenticatedUser } = require("../utils/cognito");
const { useLocalData, getStaticTeams, getStaticCountries } = require("../utils/local-data");

function enrichTeam(team) {
  return { ...team, logo: getTeamImage(team.id) };
}

function validateTeamPayload(payload) {
  const missing = ["name", "countryId"].filter((f) => !payload[f]);
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
      const teams     = getStaticTeams();
      const countries = getStaticCountries();

      if (method === "GET" && path === "/teams") {
        result = response.ok({ items: teams.map(enrichTeam), count: teams.length });

      } else if (method === "GET" && event.pathParameters?.id) {
        const team = teams.find((t) => t.id === event.pathParameters.id);
        result = team
          ? response.ok(enrichTeam(team))
          : response.notFound(`No se encontró el equipo con id '${event.pathParameters.id}'`);

      } else if (method === "POST" && path === "/teams") {
        const payload = parseJsonBody(event.body);
        if (!payload) return response.badRequest("El body no contiene JSON válido");
        const err = validateTeamPayload(payload);
        if (err) return response.badRequest(err);

        const country = countries.find((c) => c.id === payload.countryId);
        const newId   = payload.id || `team-${Date.now()}`;
        const newTeam = {
          PK: `TEAM#${newId}`, SK: "METADATA", type: "TEAM", id: newId,
          name: payload.name, countryId: payload.countryId,
          coach: payload.coach || null,
          group: payload.group || null,
        };
        result = response.created({
          message: "Equipo creado en modo local (datos no persistidos)",
          requestedBy: user.username,
          item: { ...enrichTeam(newTeam), country }
        });

      } else {
        result = response.notFound(`No existe la ruta ${method} ${path}`);
      }

    } else {
      const scanCommand  = new ScanCommand({ TableName: TABLE_NAME });
      const dbResponse   = await dynamo.send(scanCommand);
      const allItems     = dbResponse.Items || [];
      const rawTeams     = allItems.filter((i) => i.type === "TEAM"    || i.PK?.startsWith("TEAM#"));
      const rawCountries = allItems.filter((i) => i.type === "COUNTRY" || i.PK?.startsWith("COUNTRY#"));

      if (method === "GET" && path === "/teams") {
        result = response.ok({ items: rawTeams.map(enrichTeam), count: rawTeams.length });

      } else if (method === "GET" && event.pathParameters?.id) {
        const team = rawTeams.find((t) => t.id === event.pathParameters.id);
        result = team
          ? response.ok(enrichTeam(team))
          : response.notFound(`No se encontró el equipo con id '${event.pathParameters.id}'`);

      } else if (method === "POST" && path === "/teams") {
        const payload = parseJsonBody(event.body);
        if (!payload) return response.badRequest("El body no contiene JSON válido");
        const err = validateTeamPayload(payload);
        if (err) return response.badRequest(err);

        const newId   = payload.id || `team-${Date.now()}`;
        const newTeam = {
          PK: `TEAM#${newId}`, SK: "METADATA", type: "TEAM", id: newId,
          name: payload.name, countryId: payload.countryId,
          coach: payload.coach || null,
          group: payload.group || null,
        };

        await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newTeam }));

        const country = rawCountries.find((c) => c.id === payload.countryId);
        result = response.created({
          message: "Equipo creado en DynamoDB",
          requestedBy: user.username,
          item: { ...enrichTeam(newTeam), country }
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
