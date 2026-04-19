const fs = require('node:fs');
const path = require('node:path');

function parseDotEnv(raw) {
  const values = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return parseDotEnv(fs.readFileSync(filePath, 'utf8'));
}

function loadGatewayEnv(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const envFiles =
    options.envFiles || [
      path.join(rootDir, '.env.gateway'),
      path.join(rootDir, '.env.gateway.local'),
      path.join(rootDir, 'gateway', '.env'),
      path.join(rootDir, 'gateway', '.env.local'),
    ];

  const loadedFiles = [];
  const mergedValues = {};

  for (const envFile of envFiles) {
    const values = readEnvFile(envFile);
    if (!values) {
      continue;
    }

    loadedFiles.push(envFile);
    Object.assign(mergedValues, values);
  }

  for (const [key, value] of Object.entries(mergedValues)) {
    if (typeof process.env[key] !== 'string' || !process.env[key].trim()) {
      process.env[key] = value;
    }
  }

  return {
    loadedFiles,
    values: mergedValues,
  };
}

module.exports = {
  loadGatewayEnv,
  parseDotEnv,
};
