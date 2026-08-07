/**
 * Mapeo de imágenes de cromos - Fase 5
 * 
 * Este archivo mapea cada cromo a su URL de imagen en S3/CloudFront
 * Las imágenes se serviran desde CloudFront para mejor performance
 * 
 * Estructura:
 * - stickerId → imageUrl (CloudFront)
 * - playerImage → URL de foto del jugador
 * - teamLogo → URL del logo del equipo
 * - countryFlag → URL de la bandera del país
 */

// URLs de ejemplo (en producción, estas apuntarían a S3/CloudFront)
// Formato: https://{CLOUDFRONT_DOMAIN}/stickers/{filename}

const stickersImages = {
  // Ejemplo: "sticker-001": "https://d123.cloudfront.net/stickers/messi-001.jpg"
  "sticker-001": "/stickers/placeholder-001.jpg",
  "sticker-002": "/stickers/placeholder-002.jpg",
  "sticker-003": "/stickers/placeholder-003.jpg",
  "sticker-099": "/stickers/placeholder-099.jpg",
};

const playersImages = {
  "lionel-messi": "/stickers/players/messi.jpg",
  "cristiano-ronaldo": "/stickers/players/ronaldo.jpg",
  "moises-caicedo": "/stickers/players/caicedo.jpg",
  "vinicius-jr": "/stickers/players/vinicius.jpg",
};

const teamsImages = {
  "argentina": "/stickers/teams/argentina.png",
  "portugal": "/stickers/teams/portugal.png",
  "france": "/stickers/teams/france.png",
  "brazil": "/stickers/teams/brazil.png",
  "spain": "/stickers/teams/spain.png",
  "england": "/stickers/teams/england.png",
  "germany": "/stickers/teams/germany.png",
  "netherlands": "/stickers/teams/netherlands.png",
  "italy": "/stickers/teams/italy.png",
  "ecuador": "/stickers/teams/ecuador.png",
};

const countriesFlags = {
  "argentina": "/stickers/flags/argentina.png",
  "portugal": "/stickers/flags/portugal.png",
  "france": "/stickers/flags/france.png",
  "brazil": "/stickers/flags/brazil.png",
  "spain": "/stickers/flags/spain.png",
  "england": "/stickers/flags/england.png",
  "germany": "/stickers/flags/germany.png",
  "netherlands": "/stickers/flags/netherlands.png",
  "italy": "/stickers/flags/italy.png",
  "ecuador": "/stickers/flags/ecuador.png",
};

/**
 * Obtener URL de imagen de cromo
 * @param {string} stickerId - ID del cromo
 * @returns {string} URL de la imagen o placeholder
 */
function getStickerImage(stickerId) {
  return stickersImages[stickerId] || "/stickers/placeholder.jpg";
}

/**
 * Obtener URL de imagen del jugador
 * @param {string} playerId - ID del jugador
 * @returns {string} URL de la imagen del jugador
 */
function getPlayerImage(playerId) {
  return playersImages[playerId] || "/stickers/players/placeholder.jpg";
}

/**
 * Obtener URL del logo del equipo
 * @param {string} teamId - ID del equipo
 * @returns {string} URL del logo
 */
function getTeamImage(teamId) {
  return teamsImages[teamId] || "/stickers/teams/placeholder.png";
}

/**
 * Obtener URL de bandera del país
 * @param {string} countryId - ID del país
 * @returns {string} URL de la bandera
 */
function getCountryFlag(countryId) {
  return countriesFlags[countryId] || "/stickers/flags/placeholder.png";
}

/**
 * Reemplazar rutas de placeholder con CloudFront real
 * Se usa en producción cuando CloudFront está disponible
 * @param {string} url - URL con protocolo relativo
 * @param {string} cloudFrontDomain - Dominio de CloudFront
 * @returns {string} URL completa con CloudFront
 */
function buildCloudFrontUrl(url, cloudFrontDomain) {
  if (!cloudFrontDomain) {
    return url; // Retorna URL relativa
  }
  return `https://${cloudFrontDomain}${url}`;
}

module.exports = {
  stickersImages,
  playersImages,
  teamsImages,
  countriesFlags,
  getStickerImage,
  getPlayerImage,
  getTeamImage,
  getCountryFlag,
  buildCloudFrontUrl
};
