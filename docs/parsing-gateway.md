# Fakarni Parsing Gateway

## Summary
Fakarni now uses a gated parsing flow:

- local rules first
- LLM only for ambiguous cases
- optional parsing gateway for cache + routing + provider isolation

## Client Environment Variables

- `EXPO_PUBLIC_PARSE_GATEWAY_URL`
  - optional
  - if set, the app sends ambiguous parse requests to this endpoint instead of calling the model provider directly
- `EXPO_PUBLIC_LLM_MINI_MODEL`
  - optional
  - cheap refinement model when no gateway is configured
- `EXPO_PUBLIC_LLM_STRONG_MODEL`
  - optional
  - stronger fallback model used only if the mini model result still fails quality checks

If the gateway URL is not configured, the app falls back to direct provider calls using:

- `EXPO_PUBLIC_LLM_BASE_URL`
- `EXPO_PUBLIC_LLM_MODEL`
- `EXPO_PUBLIC_LLM_API_KEY`

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
