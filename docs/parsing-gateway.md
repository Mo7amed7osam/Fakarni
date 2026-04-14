# Fakarni Parsing Gateway

## Summary
Fakarni now uses a gated parsing flow:

- local rules first
- LLM only for ambiguous cases
- optional parsing gateway for cache + routing + provider isolation

## Client Environment Variables

- `EXPO_PUBLIC_PARSE_GATEWAY_URL`
  - required for production builds
  - the app sends ambiguous parse requests to this endpoint and does not ship provider credentials in the client

If the gateway URL is not configured, the mobile client falls back to local rules plus review mode instead of calling a model provider directly.

## In-Repo Gateway Service

The repo now ships a small Node gateway at:

- `gateway/server.cjs`
- `gateway/parse-gateway.cjs`

Run it locally with:

```bash
npm run gateway:parse
```

Healthcheck:

```bash
GET /health
```

Parse endpoint:

```bash
POST /parse
```

## Gateway Environment Variables

- `PARSE_GATEWAY_PORT`
  - optional
  - default `8787`
- `PARSE_GATEWAY_HOST`
  - optional
  - default `0.0.0.0`
- `PARSE_GATEWAY_BASE_URL`
  - required for live model calls
  - OpenAI-compatible base URL, for example `https://api.openai.com/v1`
- `PARSE_GATEWAY_API_KEY`
  - required for live model calls
- `PARSE_GATEWAY_MINI_MODEL`
  - required for live model calls
  - cheap model used first
- `PARSE_GATEWAY_STRONG_MODEL`
  - optional
  - stronger fallback model used only when the mini result is still weak

## Expected Gateway Request

```json
{
  "originalTranscript": "اكلم احمد بكرة 5",
  "normalizedTranscript": "اكلم احمد بكره 5",
  "language": "ar-EG",
  "timezone": "Africa/Cairo",
  "appVersion": "1.0.0",
  "llmReason": "missing_fields",
  "currentRuleParse": {
    "title": "اكلم احمد",
    "eventAt": "2026-03-27T05:00:00.000Z",
    "offsetMinutes": 0,
    "confidence": 0.83,
    "missingFields": [],
    "recurrenceSuggestion": "none"
  }
}
```

## Expected Gateway Response

```json
{
  "title": "اكلم احمد",
  "category": "personal",
  "eventAt": "2026-03-27T05:00:00.000Z",
  "offsetMinutes": 0,
  "recurrence": "none",
  "confidence": 0.94,
  "missingFields": [],
  "modelTier": "mini",
  "parsePath": "mini_model",
  "cacheHit": false
}
```

## Notes

- The client keeps the existing parse contract and only adds internal observability metadata.
- The gateway should own:
  - server-side cache
  - mini vs strong model routing
  - retries
  - provider secrets
- The mobile client should treat the gateway as optional and continue working without it.
- The shipped Node gateway currently provides:
  - exact in-memory cache
  - mini vs strong model routing
  - `/health` status route
  - OpenAI-compatible `/chat/completions` provider integration
- If the gateway provider env is missing, `/parse` returns `503 provider_not_configured` and the mobile client falls back to local review mode.
