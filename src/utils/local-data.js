const countries = require("../data/countries");
const teams = require("../data/teams");
const players = require("../data/players");
const stickers = require("../data/stickers");

const localState = {
  countries: countries.map((country) => ({ ...country })),
  teams: teams.map((team) => ({ ...team })),
  players: players.map((player) => ({ ...player })),
  stickers: stickers.map((sticker) => ({ ...sticker }))
};

function useLocalData() {
  return !process.env.TABLA_CROMOS;
}

function getStaticCountries() {
  return localState.countries.map((country) => ({ ...country }));
}

function getStaticTeams() {
  return localState.teams.map((team) => ({ ...team }));
}

function getStaticPlayers() {
  return localState.players.map((player) => ({ ...player }));
}

function getStaticStickers() {
  return localState.stickers.map((sticker) => ({ ...sticker }));
}

function addLocalSticker(sticker) {
  localState.stickers = [...localState.stickers, { ...sticker }];
  return { ...sticker };
}

function updateLocalSticker(updatedSticker) {
  localState.stickers = localState.stickers.map((sticker) =>
    sticker.id === updatedSticker.id ? { ...updatedSticker } : sticker
  );
  return { ...updatedSticker };
}

function removeLocalSticker(stickerId) {
  const removedSticker = localState.stickers.find((sticker) => sticker.id === stickerId);
  localState.stickers = localState.stickers.filter((sticker) => sticker.id !== stickerId);
  return removedSticker ? { ...removedSticker } : null;
}

module.exports = {
  useLocalData,
  getStaticCountries,
  getStaticTeams,
  getStaticPlayers,
  getStaticStickers,
  addLocalSticker,
  updateLocalSticker,
  removeLocalSticker
};
