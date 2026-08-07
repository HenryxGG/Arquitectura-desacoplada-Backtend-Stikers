/**
 * Handler de Cromos (Stickers) — con aislamiento por usuario.
 *
 * Esquema DynamoDB:
 *   PK = USER#<cognitoSub>   SK = STICKER#<stickerId>
 *
 * Cada usuario solo puede ver, crear, editar y eliminar sus propios cromos.
 * Los jugadores (PLAYER#) siguen siendo datos globales compartidos.
 *
 * Si el usuario no está autenticado (sub = null / "anonymous"), las
 * operaciones de escritura devuelven 401 y el GET devuelve lista vacía.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const IMAGE_BUCKET = process.env.IMAGE_BUCKET;

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLA_CROMOS;

const { getStickerImage, getPlayerImage } = require("../data/images");
const logger   = require("../utils/logger");
const response = require("../utils/response");
const { getAuthenticatedUser } = require("../utils/cognito");
const { getMethod, getPath }   = require("../utils/http");
const { parseJsonBody }        = require("../utils/request");
const {
  useLocalData,
  getStaticPlayers,
  getStaticStickers,
  addLocalSticker,
  updateLocalSticker,
  removeLocalSticker,
} = require("../utils/local-data");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clave primaria del usuario en DynamoDB */
function userPK(sub) {
  return `USER#${sub}`;
}

/** Clave de ordenación de un cromo específico */
function stickerSK(stickerId) {
  return `STICKER#${stickerId}`;
}

function enrichSticker(sticker, allPlayers) {
  const player = allPlayers.find((item) => item.id === sticker.playerId);
  return {
    ...sticker,
    player,
    imageUrl:    getStickerImage(sticker.id),
    playerImage: player ? getPlayerImage(player.id) : null,
  };
}

function validateStickerPayload(payload, allPlayers) {
  const missingFields = ["number", "playerId", "edition", "rarity"].filter(
    (field) => !payload[field]
  );
  if (missingFields.length > 0) {
    return `Faltan campos obligatorios: ${missingFields.join(", ")}`;
  }
  const playerExists = allPlayers.some((item) => item.id === payload.playerId);
  if (!playerExists) {
    return `El playerId '${payload.playerId}' no existe en la base de datos`;
  }
  return null;
}

/** Respuesta 401 estandarizada */
function unauthorized(msg = "Debes iniciar sesión para realizar esta acción.") {
  return response.json(401, { error: "Unauthorized", message: msg });
}

// ── Lambda handler ────────────────────────────────────────────────────────────
async function lambdaHandler(event) {
  logger.logRequest(event);

  try {
    const method = getMethod(event);
    const path   = getPath(event);
    const user   = getAuthenticatedUser(event);
    let result;

    if (method === "OPTIONS") return response.options();

    // ── MODO LOCAL (sin DynamoDB) ─────────────────────────────────────────
    if (useLocalData()) {
      const rawPlayers  = getStaticPlayers();
      const rawStickers = getStaticStickers();

      if (method === "GET" && path === "/stickers") {
        // En modo local devolvemos todos (no hay multi-usuario real)
        const rarityFilter = event.queryStringParameters?.rarity;
        let items = rawStickers.map((s) => enrichSticker(s, rawPlayers));
        if (rarityFilter) items = items.filter((s) => s.rarity === rarityFilter);
        result = response.ok({ items, count: items.length });

      } else if (method === "GET" && event.pathParameters?.id) {
        const sticker = rawStickers.find((s) => s.id === event.pathParameters.id);
        result = sticker
          ? response.ok(enrichSticker(sticker, rawPlayers))
          : response.notFound(`No se encontró el cromo con id '${event.pathParameters.id}'`);

      } else if (method === "POST" && path === "/stickers") {
        if (!user.sub) return unauthorized();
        const payload = parseJsonBody(event.body);
        if (payload === null) return response.badRequest("El body no contiene JSON válido");
        const err = validateStickerPayload(payload, rawPlayers);
        if (err) return response.badRequest(err);
        const newId = `sticker-${Date.now()}`;
        const newSticker = {
          PK: userPK(user.sub || user.username), SK: stickerSK(newId),
          type: "STICKER", id: newId, ownerSub: user.sub || user.username,
          number: payload.number, playerId: payload.playerId,
          edition: payload.edition, marketValue: payload.marketValue ?? 0,
          rarity: payload.rarity, collected: payload.collected ?? false,
        };
        const saved = addLocalSticker(newSticker);
        result = response.created({
          message: "Cromo creado con éxito en modo local",
          requestedBy: user.username,
          item: enrichSticker(saved, rawPlayers),
        });

      } else if (method === "PUT" && event.pathParameters?.id) {
        if (!user.sub) return unauthorized();
        const stickerId = event.pathParameters.id;
        const sticker   = rawStickers.find((s) => s.id === stickerId);
        if (!sticker) return response.notFound(`No se encontró el cromo '${stickerId}'`);
        const payload = parseJsonBody(event.body);
        if (payload === null) return response.badRequest("El body no contiene JSON válido");
        if (payload.playerId && !rawPlayers.some((p) => p.id === payload.playerId)) {
          return response.badRequest(`El playerId '${payload.playerId}' no existe`);
        }
        const updated = {
          ...sticker, ...payload,
          id: sticker.id, PK: sticker.PK, SK: sticker.SK, type: "STICKER",
        };
        const saved = updateLocalSticker(updated);
        result = response.ok({
          message: "Cromo actualizado en modo local",
          requestedBy: user.username,
          item: enrichSticker(saved, rawPlayers),
        });

      } else if (method === "DELETE" && event.pathParameters?.id) {
        if (!user.sub) return unauthorized();
        const stickerId = event.pathParameters.id;
        const sticker   = rawStickers.find((s) => s.id === stickerId);
        if (!sticker) return response.notFound(`No se encontró el cromo '${stickerId}'`);
        removeLocalSticker(stickerId);
        result = response.ok({
          message: `El cromo '${stickerId}' fue eliminado en modo local`,
          requestedBy: user.username,
        });

      } else {
        result = response.notFound(`No existe la ruta ${method} ${path}`);
      }

    // ── MODO DYNAMODB ─────────────────────────────────────────────────────
    } else {

      // Jugadores son datos globales — siempre los necesitamos para enriquecer
      const scanPlayers = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :prefix)",
        ExpressionAttributeValues: { ":prefix": "PLAYER#" },
      });
      const playersResp = await dynamo.send(scanPlayers);
      const rawPlayers  = playersResp.Items || [];

      if (method === "GET" && path === "/stickers") {
        // Sin autenticación → lista vacía (no hay cromos públicos)
        if (!user.sub) {
          result = response.ok({ items: [], count: 0 });
        } else {
          // Query por PK del usuario — solo sus cromos
          const queryCmd = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
            ExpressionAttributeValues: {
              ":pk":       userPK(user.sub),
              ":skPrefix": "STICKER#",
            },
          });
          const dbResp   = await dynamo.send(queryCmd);
          const stickers = dbResp.Items || [];
          const rarityFilter = event.queryStringParameters?.rarity;
          let items = stickers.map((s) => enrichSticker(s, rawPlayers));
          if (rarityFilter) items = items.filter((s) => s.rarity === rarityFilter);
          result = response.ok({ items, count: items.length });
        }

      } else if (method === "GET" && event.pathParameters?.id) {
        if (!user.sub) return unauthorized();
        const stickerId = event.pathParameters.id;
        // Busca el cromo solo dentro de la partición del usuario
        const queryCmd = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND SK = :sk",
          ExpressionAttributeValues: {
            ":pk": userPK(user.sub),
            ":sk": stickerSK(stickerId),
          },
        });
        const dbResp  = await dynamo.send(queryCmd);
        const sticker = (dbResp.Items || [])[0];
        result = sticker
          ? response.ok(enrichSticker(sticker, rawPlayers))
          : response.notFound(`No se encontró el cromo '${stickerId}'`);

      } else if (method === "POST" && path === "/stickers") {
        if (!user.sub) return unauthorized();
        const payload = parseJsonBody(event.body);
        if (payload === null) return response.badRequest("El body no contiene JSON válido");
        const err = validateStickerPayload(payload, rawPlayers);
        if (err) return response.badRequest(err);

        const newId     = `sticker-${Date.now()}`;
        const newSticker = {
          PK:          userPK(user.sub),
          SK:          stickerSK(newId),
          type:        "STICKER",
          id:          newId,
          ownerSub:    user.sub,          // guardamos la referencia al dueño
          number:      payload.number,
          playerId:    payload.playerId,
          edition:     payload.edition,
          marketValue: payload.marketValue ?? 0,
          rarity:      payload.rarity,
          collected:   payload.collected ?? false,
        };
        await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newSticker }));
        result = response.created({
          message: "Cromo creado con éxito en DynamoDB",
          requestedBy: user.username,
          item: enrichSticker(newSticker, rawPlayers),
        });

      } else if (method === "PUT" && event.pathParameters?.id) {
        if (!user.sub) return unauthorized();
        const stickerId = event.pathParameters.id;

        // Verificamos que el cromo exista Y pertenezca al usuario
        const queryCmd = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND SK = :sk",
          ExpressionAttributeValues: {
            ":pk": userPK(user.sub),
            ":sk": stickerSK(stickerId),
          },
        });
        const dbResp  = await dynamo.send(queryCmd);
        const sticker = (dbResp.Items || [])[0];
        if (!sticker) {
          result = response.notFound(`No se encontró el cromo '${stickerId}'`);
        } else {
          const payload = parseJsonBody(event.body);
          if (payload === null) return response.badRequest("El body no contiene JSON válido");
          if (payload.playerId && !rawPlayers.some((p) => p.id === payload.playerId)) {
            return response.badRequest(`El playerId '${payload.playerId}' no existe`);
          }
          const updated = {
            ...sticker, ...payload,
            // claves inmutables
            id:       sticker.id,
            PK:       sticker.PK,
            SK:       sticker.SK,
            type:     "STICKER",
            ownerSub: sticker.ownerSub,
          };
          await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
          result = response.ok({
            message: "Cromo actualizado con éxito en DynamoDB",
            requestedBy: user.username,
            item: enrichSticker(updated, rawPlayers),
          });
        }

      } else if (method === "DELETE" && event.pathParameters?.id) {
        if (!user.sub) return unauthorized();
        const stickerId = event.pathParameters.id;

        // Verificamos propiedad antes de borrar
        const queryCmd = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND SK = :sk",
          ExpressionAttributeValues: {
            ":pk": userPK(user.sub),
            ":sk": stickerSK(stickerId),
          },
        });
        const dbResp  = await dynamo.send(queryCmd);
        const sticker = (dbResp.Items || [])[0];
        if (!sticker) {
          result = response.notFound(`No se encontró el cromo '${stickerId}'`);
        } else {
          await dynamo.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: sticker.PK, SK: sticker.SK },
          }));
          result = response.ok({
            message: `El cromo '${stickerId}' fue eliminado de DynamoDB`,
            requestedBy: user.username,
          });
        }

      } else if (method === "POST" && event.pathParameters?.id && path.endsWith("/upload-url")) {
        if (!user.sub) return unauthorized();
        if (!IMAGE_BUCKET) {
          result = response.internalServerError("IMAGE_BUCKET no configurado en el entorno.");
        } else {
          const stickerId  = event.pathParameters.id;
          const body       = parseJsonBody(event.body) || {};
          const contentType = body.contentType || "image/jpeg";
          const ext         = contentType.split("/")[1]?.replace("svg+xml", "svg") || "jpg";
          const key         = `stickers/${stickerId}.${ext}`;

          const command  = new PutObjectCommand({ Bucket: IMAGE_BUCKET, Key: key, ContentType: contentType });
          const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

          result = response.ok({
            uploadUrl,
            key,
            bucket:    IMAGE_BUCKET,
            expiresIn: 300,
            message:   "URL válida por 5 minutos. Haz PUT con el archivo como body.",
          });
        }

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
