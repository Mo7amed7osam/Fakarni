const { getGateway } = require('./_gateway.cjs');
const { readJsonBody, sendJson } = require('./_utils.cjs');

module.exports = async function parseHandler(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, {
      error: 'method_not_allowed',
      message: 'Use POST /parse.',
    });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const response = await getGateway().handleParseRequest(payload);
    sendJson(res, 200, response);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.code || 'internal_error',
      message: error.message || 'Unexpected gateway error.',
    });
  }
};
