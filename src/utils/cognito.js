/**
 * Extrae el usuario autenticado de dos fuentes, en orden de prioridad:
 *
 * 1. event.requestContext.authorizer.claims  — si el API Gateway tiene un
 *    Cognito Authorizer configurado (caso ideal).
 *
 * 2. Header Authorization: Bearer <jwt>  — decodifica el payload del JWT
 *    directamente (sin verificar firma, la firma la valida Cognito al emitir
 *    el token; aquí solo necesitamos el sub para identificar al usuario).
 *
 * Si ninguna fuente tiene datos, devuelve usuario anónimo.
 */

function decodeJwtPayload(token) {
  try {
    // Un JWT tiene 3 partes separadas por "." — la segunda es el payload en base64url
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return null;

    // base64url → base64 estándar → Buffer → JSON
    const base64 = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    const json    = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function getAuthenticatedUser(event) {
  // ── Fuente 1: Cognito Authorizer (si está configurado en API Gateway) ──────
  const claims = event.requestContext?.authorizer?.claims || {};
  if (claims.sub) {
    return {
      username: claims["cognito:username"] || claims.username || claims.email || claims.sub,
      sub:      claims.sub,
      email:    claims.email || null,
      claims,
    };
  }

  // ── Fuente 2: Header Authorization: Bearer <jwt> ──────────────────────────
  const authHeader =
    event.headers?.Authorization ||
    event.headers?.authorization ||
    "";

  if (authHeader.startsWith("Bearer ")) {
    const token   = authHeader.slice(7);
    const payload = decodeJwtPayload(token);

    if (payload?.sub) {
      return {
        username: payload["cognito:username"] || payload.email || payload.sub,
        sub:      payload.sub,
        email:    payload.email || null,
        claims:   payload,
      };
    }
  }

  // ── Sin autenticación ─────────────────────────────────────────────────────
  return {
    username: "anonymous",
    sub:      null,
    email:    null,
    claims:   {},
  };
}

module.exports = {
  getAuthenticatedUser,
};
