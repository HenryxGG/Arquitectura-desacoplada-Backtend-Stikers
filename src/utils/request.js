function parseJsonBody(body) {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function getIdFromPath(path) {
  return path.split("/").filter(Boolean).pop();
}

module.exports = {
  parseJsonBody,
  getIdFromPath
};

