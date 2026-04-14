# Fakarni Release Environment Matrix

Last reviewed: 2026-04-14

This file defines the minimum environment contract for a production App Store build.
Anything outside this contract should be treated as non-release configuration.

## Client Public Environment

These values are compiled into the mobile app and are therefore public by design.
They must never contain provider secrets.

### Required for production

- `EXPO_PUBLIC_PARSE_GATEWAY_URL`
  - Example: `https://parse.your-domain.com/parse`
  - Must be a live production endpoint
  - Must not point to localhost, LAN IPs, preview hosts, or staging
- `EXPO_PUBLIC_APP_VERSION`
  - Example: `1.0.0`
  - Should match the release marketing version

### Required if analytics are enabled in production

- `EXPO_PUBLIC_POSTHOG_KEY`
  - Public project token only
- `EXPO_PUBLIC_POSTHOG_HOST`
  - Current expected value: `https://us.i.posthog.com`

### Required only if Google Calendar connection is shipped

- `EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_CALENDAR_ANDROID_CLIENT_ID`

## Server-Only Environment

These values belong only on the parsing gateway server.
They must never be present in Expo public env, app config, or client code.

- `PARSE_GATEWAY_BASE_URL`
- `PARSE_GATEWAY_API_KEY`
- `PARSE_GATEWAY_MINI_MODEL`
- `PARSE_GATEWAY_STRONG_MODEL`
- any provider-specific secret, admin token, or service account credential

## Release Rules

- The mobile client may know where the parsing gateway lives.
- The mobile client must not know how the gateway authenticates to model providers.
- The mobile client may know the PostHog project token.
- The mobile client must not contain test, debug, or preview endpoints in the release build.
- If production analytics are not ready, ship with analytics disabled instead of inventing a temporary host.

## Current Repo Findings

- `src/services/llm.ts` reads only `EXPO_PUBLIC_PARSE_GATEWAY_URL` and does not read provider API keys.
- `.env.example` previously pointed to localhost and is now changed to production-shaped placeholders.
- Local `.env` contents are not part of release, but any provider keys previously used from client builds should be rotated before submission.

## Production Sign-Off

Before cutting a release candidate, verify all of the following:

- `EXPO_PUBLIC_PARSE_GATEWAY_URL` resolves over HTTPS and returns a healthy `POST /parse` response path
- production parsing gateway logs show requests from the current app version
- `EXPO_PUBLIC_POSTHOG_HOST` and `EXPO_PUBLIC_POSTHOG_KEY` match the intended production project
- no release env references localhost, `192.168.*`, `10.*`, `.local`, preview domains, or staging domains
- production client build starts and creates a reminder without any direct provider calls

## Submission Status

Current status: `Prepared, but not complete`

Reason:

- the production env contract is now documented
- the final live production gateway URL still has to be supplied and validated
- analytics production values still have to be confirmed at release time
