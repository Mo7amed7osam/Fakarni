const { createParseGateway } = require('../parse-gateway.cjs');

let gateway;

function getGateway() {
  if (!gateway) {
    gateway = createParseGateway();
  }

  return gateway;
}

module.exports = {
  getGateway,
};
