# Fakarni Feedback Google Form Setup

Fakarni can submit in-app feedback directly to a Google Form without running a custom backend.
Responses are stored in the Google Form destination and should be linked to a Google Sheet for easy review.

## What To Create

Create one Google Form with these fields:

- `source`
- `reason`
- `note`
- `timestamp`
- `app version`
- `app build`
- `platform`
- `locale`

After creating the form, link it to a Google Sheet from the Google Forms responses tab.

## Public Client Environment

These values are compiled into the app and are public:

- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_ACTION_URL`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_SOURCE_ENTRY_ID`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_REASON_ENTRY_ID`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_NOTE_ENTRY_ID`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_TIMESTAMP_ENTRY_ID`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_APP_VERSION_ENTRY_ID`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_APP_BUILD_ENTRY_ID`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_PLATFORM_ENTRY_ID`
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_LOCALE_ENTRY_ID`

The action URL should be the public Google Forms `formResponse` endpoint, for example:

```text
https://docs.google.com/forms/d/e/<FORM_ID>/formResponse
```

Each entry env var should contain the exact Google Forms field name, for example:

```text
entry.123456789
```

## How To Find The Entry IDs

Use one of these methods:

1. Open the live form in the browser, inspect the field input, and copy its `name` attribute.
2. Submit a test response in the browser and inspect the network request payload for the `entry.*` keys.

Store the exact `entry.*` value for each field in the matching env var.

## What The App Sends

The app submits this payload to Google Forms:

```json
{
  "source": "settings_manual",
  "reason": "timing",
  "note": "The reminder fired late.",
  "timestamp": "2026-04-19T12:00:00.000Z",
  "appVersion": "1.0.0",
  "appBuild": "42",
  "platform": "ios",
  "locale": "ar-EG"
}
```

Notes:

- `note` is omitted when blank.
- If `reason` is `other`, the app requires a note before sending.
- The app only shows success after Google Forms accepts the request.
