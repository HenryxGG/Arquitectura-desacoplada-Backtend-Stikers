/**
 * POST /stickers/full
 *
 * Crea en un solo paso: país → equipo → jugador → cromo.
 * El cromo queda asociado al usuario autenticado (Cognito sub).
 *
 * Esquema DynamoDB resultante:
 *   País    → PK: COUNTRY#<id>        SK: METADATA      (datos globales)
 *   Equipo  → PK: TEAM#<id>           SK: METADATA      (datos globales)
 *   Jugador → PK: PLAYER#<id>         SK: METADATA      (datos globales)
 *   Cromo   → PK: USER#<cognitoSub>   SK: STICKER#<id>  (privado del usuario)
 *
 * Body esperado:
 * {
 *   country: { name, continent, fifaCode?, fifaRanking?, flag? },
 *   team:    { name, coach?, group? },
 *   player:  { name, position, jerseyNumber?, initials? },
 *   sticker: { number, edition, rarity, marketValue?, collected? }
 * }
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client  = new DynamoDBClient({});
const dynamo  = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLA_CROMOS;

const logger   = require("../utils/logger");
const response = require("../utils/response");
const { parseJsonBody }       = require("../utils/request");
const { getAuthenticatedUser } = require("../utils/cognito");
const { getMethod }           = require("../utils/http");
const {
  useLocalData,
  getStaticPlayers,
  addLocalSticker,
} = require("../utils/local-data");

// ── Validación del body completo ─────────────────────────────────────────────
function validatePayload(payload) {
  if (!payload.country || typeof payload.country !== "object") {
    return "Falta el bloque 'country' con los datos del país.";
  }
  if (!payload.country.name || !payload.country.continent) {
    return "El país requiere 'name' y 'continent'.";
  }
  if (!payload.team || typeof payload.team !== "object") {
    return "Falta el bloque 'team' con los datos del equipo.";
  }
  if (!payload.team.name) {
    return "El equipo requiere 'name'.";
  }
  if (!payload.player || typeof payload.player !== "object") {
    return "Falta el bloque 'player' con los datos del jugador.";
  }
  if (!payload.player.name || !payload.player.position) {
    return "El jugador requiere 'name' y 'position'.";
  }
  if (!payload.sticker || typeof payload.sticker !== "object") {
    return "Falta el bloque 'sticker' con los datos del cromo.";
  }
  if (!payload.sticker.number || !payload.sticker.edition || !payload.sticker.rarity) {
    return "El cromo requiere 'number', 'edition' y 'rarity'.";
  }
  return null;
}

// ── Handler principal ────────────────────────────────────────────────────────
async function lambdaHandler(event) {
  logger.logRequest(event);

  try {
    const method = getMethod(event);
    const user   = getAuthenticatedUser(event);

    if (method === "OPTIONS") return response.options();

    if (method !== "POST") {
      return response.notFound(`Método ${method} no soportado en este endpoint.`);
    }

    // El usuario debe estar autenticado para crear un cromo
    if (!user.sub) {
      return response.json(401, {
        error: "Unauthorized",
        message: "Debes iniciar sesión para crear un cromo.",
      });
    }

    const payload = parseJsonBody(event.body);
    if (payload === null) {
      return response.badRequest("El body no contiene JSON válido.");
    }

    const validationError = validatePayload(payload);
    if (validationError) {
      return response.badRequest(validationError);
    }

    const { country: countryData, team: teamData, player: playerData, sticker: stickerData } = payload;

    // ── IDs generados ────────────────────────────────────────────────────────
    const countryId = countryData.id || `country-${Date.now()}`;
    const teamId    = teamData.id    || `team-${Date.now() + 1}`;
    const playerId  = playerData.id  || `player-${Date.now() + 2}`;
    const stickerId = stickerData.id || `sticker-${Date.now() + 3}`;

    // ── Construir items ──────────────────────────────────────────────────────
    const newCountry = {
      PK: `COUNTRY#${countryId}`, SK: "METADATA", type: "COUNTRY", id: countryId,
      name:        countryData.name,
      continent:   countryData.continent,
      fifaCode:    countryData.fifaCode    || null,
      fifaRanking: countryData.fifaRanking ? Number(countryData.fifaRanking) : null,
      flag:        countryData.flag        || null,
    };

    const newTeam = {
      PK: `TEAM#${teamId}`, SK: "METADATA", type: "TEAM", id: teamId,
      name:      teamData.name,
      countryId: countryId,
      coach:     teamData.coach || null,
      group:     teamData.group || null,
    };

    const newPlayer = {
      PK: `PLAYER#${playerId}`, SK: "METADATA", type: "PLAYER", id: playerId,
      name:         playerData.name,
      position:     playerData.position,
      teamId:       teamId,
      jerseyNumber: playerData.jerseyNumber || null,
      initials:     playerData.initials
        || playerData.name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase(),
    };

    // El cromo usa PK=USER#sub para quedar en la partición privada del usuario
    const newSticker = {
      PK:          `USER#${user.sub}`,
      SK:          `STICKER#${stickerId}`,
      type:        "STICKER",
      id:          stickerId,
      ownerSub:    user.sub,        // referencia explícita al dueño
      number:      stickerData.number,
      playerId:    playerId,
      edition:     stickerData.edition,
      rarity:      stickerData.rarity,
      marketValue: stickerData.marketValue != null ? Number(stickerData.marketValue) : 0,
      collected:   stickerData.collected   != null ? Boolean(stickerData.collected)  : false,
    };

    // ── Persistencia ─────────────────────────────────────────────────────────
    if (useLocalData()) {
      addLocalSticker(newSticker);

      return response.created({
        message: "Cromo completo creado en modo local (datos no persistidos en DB)",
        requestedBy: user.username,
        created: {
          country: newCountry,
          team:    newTeam,
          player:  newPlayer,
          sticker: newSticker,
        },
      });
    }

    // Modo DynamoDB:
    //   País, equipo y jugador → globales (PK=COUNTRY#/TEAM#/PLAYER#)
    //   Cromo                  → privado del usuario (PK=USER#sub)
    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newCountry }));
    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newTeam    }));
    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newPlayer  }));
    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newSticker }));

    logger.logResult({
      route: "/stickers/full",
      method: "POST",
      statusCode: 201,
      username:   user.username,
      ownerSub:   user.sub,
      createdIds: { countryId, teamId, playerId, stickerId },
    });

    return response.created({
      message: "Cromo completo creado con éxito en DynamoDB",
      requestedBy: user.username,
      created: {
        country: newCountry,
        team:    newTeam,
        player:  newPlayer,
        sticker: newSticker,
      },
    });

  } catch (error) {
    logger.logError(error, event);
    return response.internalServerError();
  }
}

module.exports = { lambdaHandler };
