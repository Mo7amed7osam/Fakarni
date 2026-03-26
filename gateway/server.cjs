const { createHttpServer, createParseGateway } = require('./parse-gateway.cjs');

const port = Number(process.env.PARSE_GATEWAY_PORT || 8787);
const host = process.env.PARSE_GATEWAY_HOST || '0.0.0.0';

const gateway = createParseGateway();
const server = createHttpServer(gateway);

server.on('error', (error) => {
  const prefix = '[parse-gateway]';
  if (error && error.code === 'EADDRINUSE') {
    console.error(`${prefix} port ${port} is already in use.`);
  } else if (error && error.code === 'EPERM') {
    console.error(
      `${prefix} listen permission denied on ${host}:${port}. Try another host or port in your environment.`
    );
  } else {
    console.error(`${prefix} failed to start: ${error?.message || 'unknown error'}`);
  }

  process.exit(1);
});

server.listen(port, host, () => {
  const publicHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`[parse-gateway] listening on http://${publicHost}:${port}/parse`);
  console.log(`[parse-gateway] healthcheck http://${publicHost}:${port}/health`);
  console.log(
    `[parse-gateway] provider ${gateway.config.baseUrl && gateway.config.apiKey && gateway.config.miniModel ? 'configured' : 'missing'}`
  );
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
