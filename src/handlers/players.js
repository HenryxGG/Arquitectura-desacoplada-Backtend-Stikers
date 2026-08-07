const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLA_CROMOS;

const { getPlayerImage, getTeamImage, getCountryFlag } = require("../data/images");
const logger = require("../utils/logger");
const response = require("../utils/response");
const { getMethod, getPath } = require("../utils/http");
const { parseJsonBody } = require("../utils/request");
const { getAuthenticatedUser } = require("../utils/cognito");
const { useLocalData, getStaticPlayers, getStaticTeams, getStaticCountries } = require("../utils/local-data");

function enrichPlayer(player, allTeams, allCountries) {
  const team = allTeams.find((item) => item.id === player.teamId);
  const country = allCountries.find((item) => item.id === team?.countryId);
  return {
    ...player,
    team,
    country,
    playerImage: getPlayerImage(player.id),
    teamImage: team ? getTeamImage(team.id) : null,
    countryFlag: country ? getCountryFlag(country.id) : null
  };
}

function validatePlayerPayload(payload) {
  const missing = ["name", "position", "teamId"].filter((f) => !payload[f]);
  if (missing.length > 0) return `Faltan campos obligatorios: ${missing.join(", ")}`;
  return null;
}

async function lambdaHandler(event) {
  logger.logRequest(event);

  try {
    const method = getMethod(event);
    const path = getPath(event);
    const user = getAuthenticatedUser(event);

    if (method === "OPTIONS") return response.options();

    let result;

    if (useLocalData()) {
      const rawPlayers = getStaticPlayers();
      const rawTeams = getStaticTeams();
      const rawCountries = getStaticCountries();

      if (method === "GET" && path === "/players") {
        const countryFilter = event.queryStringParameters?.country;
        let enrichedPlayers = rawPlayers.map((p) => enrichPlayer(p, rawTeams, rawCountries));
        if (countryFilter) enrichedPlayers = enrichedPlayers.filter((p) => p.country?.id === countryFilter);
        result = response.ok({ items: enrichedPlayers, count: enrichedPlayers.length });

      } else if (method === "GET" && event.pathParameters?.id) {
        const player = rawPlayers.find((p) => p.id === event.pathParameters.id);
        result = player
          ? response.ok(enrichPlayer(player, rawTeams, rawCountries))
          : response.notFound(`No se encontró el jugador con id '${event.pathParameters.id}'`);

      } else if (method === "POST" && path === "/players") {
        const payload = parseJsonBody(event.body);
        if (!payload) return response.badRequest("El body no contiene JSON válido");
        const err = validatePlayerPayload(payload);
        if (err) return response.badRequest(err);

        const newId = payload.id || `player-${Date.now()}`;
        const newPlayer = {
          PK: `PLAYER#${newId}`, SK: "METADATA",
          type: "PLAYER", id: newId,
          name: payload.name,
          position: payload.position,
          teamId: payload.teamId,
          jerseyNumber: payload.jerseyNumber || null,
          initials: payload.initials || payload.name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()
        };
        result = response.created({
          message: "Jugador creado en modo local (datos no persistidos)",
          requestedBy: user.username,
          item: enrichPlayer(newPlayer, rawTeams, rawCountries)
        });

      } else {
        result = response.notFound(`No existe la ruta ${method} ${path}`);
      }

    } else {
      const scanCommand = new ScanCommand({ TableName: TABLE_NAME });
      const dbResponse = await dynamo.send(scanCommand);
      const allItems = dbResponse.Items || [];
      const rawPlayers = allItems.filter((i) => i.type === "PLAYER" || i.PK?.startsWith("PLAYER#"));
      const rawTeams = allItems.filter((i) => i.type === "TEAM" || i.PK?.startsWith("TEAM#"));
      const rawCountries = allItems.filter((i) => i.type === "COUNTRY" || i.PK?.startsWith("COUNTRY#"));

      if (method === "GET" && path === "/players") {
        const countryFilter = event.queryStringParameters?.country;
        let enrichedPlayers = rawPlayers.map((p) => enrichPlayer(p, rawTeams, rawCountries));
        if (countryFilter) enrichedPlayers = enrichedPlayers.filter((p) => p.country?.id === countryFilter);
        result = response.ok({ items: enrichedPlayers, count: enrichedPlayers.length });

      } else if (method === "GET" && event.pathParameters?.id) {
        const player = allItems.find((i) => i.id === event.pathParameters.id && (i.type === "PLAYER" || i.PK?.startsWith("PLAYER#")));
        if (!player) {
          result = response.notFound(`No se encontró el jugador con id '${event.pathParameters.id}'`);
        } else {
          result = response.ok(enrichPlayer(player, rawTeams, rawCountries));
        }

      } else if (method === "POST" && path === "/players") {
        const payload = parseJsonBody(event.body);
        if (!payload) return response.badRequest("El body no contiene JSON válido");
        const err = validatePlayerPayload(payload);
        if (err) return response.badRequest(err);

        const newId = payload.id || `player-${Date.now()}`;
        const newPlayer = {
          PK: `PLAYER#${newId}`, SK: "METADATA",
          type: "PLAYER", id: newId,
          name: payload.name,
          position: payload.position,
          teamId: payload.teamId,
          jerseyNumber: payload.jerseyNumber || null,
          initials: payload.initials || payload.name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()
        };

        await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newPlayer }));

        result = response.created({
          message: "Jugador creado en DynamoDB",
          requestedBy: user.username,
          item: enrichPlayer(newPlayer, rawTeams, rawCountries)
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
