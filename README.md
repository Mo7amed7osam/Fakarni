# Fakarni

Fakarni is a voice-first reminder app built with Expo and React Native. The product is designed around fast voice capture, Arabic and English reminder parsing, local notifications, and optional calendar sync.

This repository also includes:

- a small parsing gateway for server-side LLM routing and secret isolation
- a standalone landing site for marketing and policy pages
- release and App Store operations docs

## Repository Layout

- `src/`: app screens, services, state, and parsing logic
- `tests/`: parser, gateway, notification, and feedback tests
- `gateway/`: Node-based parsing gateway and Vercel API handlers
- `landing/`: static marketing site and support/privacy pages
- `docs/`: release, App Store, validation, analytics, and gateway docs
- `ios/`, `android/`: native Expo-generated projects

## Tech Stack

- Expo 55
- React Native 0.83
- React 19
- TypeScript
- Node.js gateway for ambiguous parsing requests
- PostHog for analytics
- Expo Notifications, Calendar, Speech, and Secure Store

## Prerequisites

- Node.js 20+
- npm
- Xcode for iOS development
- Android Studio for Android development
- Expo-compatible simulator/device setup

## Getting Started

Install dependencies:

```bash
npm install
```

Create the app env file:

```bash
cp .env.example .env
```

If you want to run the parsing gateway locally, create the gateway env file:

```bash
cp gateway/.env.example .env.gateway
```

Start the Expo app:

```bash
npm start
```

Run on iOS:

```bash
npm run ios
```

Run on Android:

```bash
npm run android
```

Run the parsing gateway:

```bash
npm run gateway:parse
```

## Environment Variables

### Mobile App

The main client-side env file is `.env`. Start from `.env.example`.

Important variables:

- `EXPO_PUBLIC_PARSE_GATEWAY_URL`: parsing gateway base URL used for ambiguous reminder parsing
- `EXPO_PUBLIC_APP_VERSION`: app version exposed to the client
- `EXPO_PUBLIC_POSTHOG_KEY`: PostHog project key
- `EXPO_PUBLIC_POSTHOG_HOST`: PostHog host
- `EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_*`: feedback form action URL and entry IDs
- `EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_CLIENT_ID`: iOS OAuth client for Google Calendar
- `EXPO_PUBLIC_GOOGLE_CALENDAR_ANDROID_CLIENT_ID`: Android OAuth client for Google Calendar

### Parsing Gateway

Gateway secrets must stay server-side. The local gateway loader checks:

- `.env.gateway`
- `.env.gateway.local`
- `gateway/.env`
- `gateway/.env.local`

Important variables:

- `PARSE_GATEWAY_PORT`
- `PARSE_GATEWAY_HOST`
- `PARSE_GATEWAY_BASE_URL`
- `PARSE_GATEWAY_API_KEY`
- `PARSE_GATEWAY_MINI_MODEL`
- `PARSE_GATEWAY_STRONG_MODEL`

If the gateway is not configured, the app falls back to local rules plus manual review instead of direct model calls from the client.

## Available Scripts

- `npm start`: start Expo
- `npm run ios`: build/run the iOS app locally
- `npm run android`: build/run the Android app locally
- `npm run gateway:parse`: run the local parsing gateway
- `npm run assets:brand`: generate brand assets
- `npm run release:env-check`: validate release environment configuration
- `npm run typecheck`: run TypeScript type checking
- `npm run test:parser`: run parser-related tests
- `npm run test:gateway`: run gateway tests
- `npm run test:feedback`: run feedback submission tests

## Testing

Run the main checks with:

```bash
npm run typecheck
npm run test:parser
npm run test:gateway
npm run test:feedback
```

There is also a notification-focused test at `tests/notifications.sound.test.cjs` if you want to run targeted coverage while changing reminder delivery behavior.

## Product Notes

- The app supports Arabic (`ar-EG`) and English UI and reminder flows.
- Reminder parsing uses local rules first and can escalate ambiguous cases through the gateway.
- Calendar save can target the device calendar and Google Calendar depending on user setup.
- The landing site is intentionally separate from the mobile app target.

## Useful Docs

- [Parsing gateway](./docs/parsing-gateway.md)
- [Real device validation](./docs/real-device-validation.md)
- [App Store launch checklist](./docs/app-store-launch-checklist.md)
- [Release environment matrix](./docs/release-environment-matrix.md)
- [Landing site notes](./landing/README.md)

## Notes

- The Expo app name is `Fakarni` while the repository folder is currently `ghost`.
- `memory.md` contains working product/context notes and should be treated as internal project material rather than end-user documentation.
