const fs = require('fs');
const path = require('path');

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

function readLocalEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(envPath, 'utf8'));
}

function isUnsafePublicUrl(value) {
  return (
    /localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\./i.test(
      value
    ) ||
    /\.local\b/i.test(value) ||
    /staging|preview|test|dev\b/i.test(value)
  );
}

function getValue(env, key) {
  return typeof process.env[key] === 'string' && process.env[key].trim()
    ? process.env[key].trim()
    : typeof env[key] === 'string'
      ? env[key].trim()
      : '';
}

const appJsonPath = path.join(process.cwd(), 'app.json');
const localEnvPath = path.join(process.cwd(), '.env');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const localEnv = readLocalEnv(localEnvPath);
const failures = [];
const warnings = [];

const parseGatewayUrl = getValue(localEnv, 'EXPO_PUBLIC_PARSE_GATEWAY_URL');
const appVersion = getValue(localEnv, 'EXPO_PUBLIC_APP_VERSION');
const posthogKey = getValue(localEnv, 'EXPO_PUBLIC_POSTHOG_KEY');
const posthogHost = getValue(localEnv, 'EXPO_PUBLIC_POSTHOG_HOST');

const expectedVersion = appJson?.expo?.version ?? '';

if (parseGatewayUrl) {
  if (!/^https:\/\//i.test(parseGatewayUrl)) {
    failures.push('EXPO_PUBLIC_PARSE_GATEWAY_URL must use HTTPS.');
  }

  if (isUnsafePublicUrl(parseGatewayUrl)) {
    failures.push(
      'EXPO_PUBLIC_PARSE_GATEWAY_URL points to a localhost, LAN, preview, staging, or debug-style host.'
    );
  }
} else {
  warnings.push(
    'EXPO_PUBLIC_PARSE_GATEWAY_URL is not set. Release will rely on the local rules-first parsing path.'
  );
}

if (appVersion && expectedVersion && appVersion !== expectedVersion) {
  failures.push(
    `EXPO_PUBLIC_APP_VERSION (${appVersion}) does not match app.json version (${expectedVersion}).`
  );
}

if (!appVersion) {
  warnings.push('EXPO_PUBLIC_APP_VERSION is not set. The build will fall back to native version metadata.');
}

if (posthogKey || posthogHost) {
  if (!posthogKey || !posthogHost) {
    failures.push(
      'Analytics env must be all-or-nothing: set both EXPO_PUBLIC_POSTHOG_KEY and EXPO_PUBLIC_POSTHOG_HOST, or neither.'
    );
  } else {
    if (!/^https:\/\//i.test(posthogHost)) {
      failures.push('EXPO_PUBLIC_POSTHOG_HOST must use HTTPS.');
    }

    if (isUnsafePublicUrl(posthogHost)) {
      failures.push(
        'EXPO_PUBLIC_POSTHOG_HOST points to a localhost, LAN, preview, staging, or debug-style host.'
      );
    }

    if (posthogHost !== 'https://us.i.posthog.com') {
      warnings.push(
        `EXPO_PUBLIC_POSTHOG_HOST is ${posthogHost}. Confirm this is the intended production PostHog host.`
      );
    }
  }
} else {
  warnings.push(
    'PostHog env is not set. Anonymous analytics will stay disabled in the release build.'
  );
}

console.log('Release environment summary');
console.log(`- app version: ${expectedVersion || 'missing from app.json'}`);
console.log(`- EXPO_PUBLIC_APP_VERSION: ${appVersion || 'not set'}`);
console.log(`- parsing gateway: ${parseGatewayUrl || 'disabled'}`);
console.log(`- analytics: ${posthogKey && posthogHost ? 'configured' : 'disabled'}`);

if (warnings.length) {
  console.log('\nWarnings');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (failures.length) {
  console.error('\nFailures');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nRelease environment check passed.');
