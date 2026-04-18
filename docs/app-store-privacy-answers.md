# Fakarni App Privacy Answers

Last prepared: 2026-04-19

This file is a working draft for the App Privacy section in App Store Connect.
Use it to answer Apple consistently with the actual shipped behavior.

Fastest-submit default for 1.0:

- Ship with analytics disabled unless verified production PostHog env is present in the submitted build.
- Ship with remote parsing disabled unless a verified production parsing gateway is present in the submitted build.
- If either optional service is absent, answer App Privacy narrowly for the build you actually upload.

## What The App Does

- Fakarni stores reminder data locally on the device.
- Fakarni uses local notifications for reminder delivery.
- Fakarni can optionally write reminders to calendar providers when the user enables calendar sync.
- Fakarni can optionally send anonymous analytics events when analytics are enabled.
- Fakarni can optionally send reminder text to a production parsing gateway when `EXPO_PUBLIC_PARSE_GATEWAY_URL` is configured.

## Recommended App Privacy Position

Use this as the starting point in App Store Connect, then verify it against the exact release build you submit.

### Data Not Used For Tracking

- The app does not use ATT / IDFA tracking.
- The app privacy manifest sets `NSPrivacyTracking` to `false`.
- There is no sign-in, ad-targeting, or third-party tracking flow in the shipped app.

### Data Likely Collected

1. `Identifiers` or `Diagnostics`
   Only if analytics are enabled in production.
   App events are sent to PostHog as anonymous product analytics.

2. `User Content`
   Only if the production parsing gateway is enabled.
   Reminder text may be sent to the parsing gateway to interpret the reminder.

3. `Calendar data`
   Only when the user explicitly enables calendar sync and grants access.

### Narrowest Safe Submission Position

If the submitted build does not include production analytics and does not include a production parsing gateway:

- `User Content`: `No`
- `Identifiers`: `No`
- `Usage Data`: `No`
- `Diagnostics`: `No`
- Calendar-related answers still depend on whether Apple interprets optional on-device calendar write access as collected data for your exact submission; verify in App Store Connect before finalizing.

### Data Not Collected For Analytics Based On Current App Behavior

- Raw speech transcripts are not sent through analytics events.
- Reminder titles are not sent through analytics events.
- Reminder data is primarily stored locally, not synced through an in-app account backend.

## Suggested Answer Sheet

These are the answers you are likely to need in App Store Connect.

### Contact Info

- Developer contact email: `info@quantara.site`
- Privacy policy URL: `https://fakarni.quantara.site/privacy`

### Tracking

- Does this app track users? `No`

### Health And Fitness

- Collected? `No`

### Location

- Collected? `No`

### Sensitive Info

- Collected? `No`, unless your final parsing gateway vendor terms force a different interpretation

### Contacts

- Collected? `No`

### User Content

- Collected? `Yes`, only if the production parsing gateway is enabled
- Data type: reminder text or spoken reminder content converted to text
- Linked to the user? `No account system in app; answer based on your gateway logs and vendor setup`
- Used for tracking? `No`
- Purpose: `App functionality`

### Search History

- Collected? `No`

### Browsing History

- Collected? `No`

### Identifiers

- Collected? `Possibly yes` if your analytics setup includes a distinct anonymous device/app identifier
- Linked to the user? `No`
- Used for tracking? `No`
- Purpose: `Analytics`

### Purchases

- Collected? `No`

### Usage Data

- Collected? `Yes` if analytics are enabled
- Examples: anonymous app events, feature usage, permission state changes, reminder flow milestones
- Linked to the user? `No`
- Used for tracking? `No`
- Purpose: `Analytics`, `Product personalization not claimed`, `App functionality only where necessary`

### Diagnostics

- Collected? `Possibly yes` if analytics captures error or flush-status metadata
- Linked to the user? `No`
- Used for tracking? `No`
- Purpose: `App functionality`, `Analytics`

## Final Verification Before Submission

Before you answer App Privacy in App Store Connect, verify:

- whether analytics are enabled in the submitted build
- whether the production parsing gateway is enabled in the submitted build
- whether PostHog uses only anonymous analytics with no advertising or cross-app tracking
- whether any third-party SDK changed the collected-data story after the latest dependency update

If analytics or remote parsing are disabled for the release build, answer more narrowly and do not over-disclose.
