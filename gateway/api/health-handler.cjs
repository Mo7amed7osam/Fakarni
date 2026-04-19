const { getGateway } = require('./_gateway.cjs');
const { sendJson } = require('./_utils.cjs');

module.exports = async function healthHandler(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, {
      error: 'method_not_allowed',
      message: 'Use GET /health.',
    });
    return;
  }

  sendJson(res, 200, getGateway().getHealth());
};
