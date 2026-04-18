# Fakarni App Store Metadata Pack

Last prepared: 2026-04-19

This file is the working draft for App Store Connect.
It is designed to be copied into App Store Connect with minimal editing.

Release posture locked for 1.0:

- English-only App Store listing
- Support URL: `https://fakarni.quantara.site/support`
- Privacy URL: `https://fakarni.quantara.site/privacy`
- If the submitted build does not ship a production parsing gateway, remove gateway-specific wording from the final review notes
- If the submitted build does not ship production analytics, answer App Privacy more narrowly and keep analytics disabled in the release build

## Apple Constraints

These limits come from Apple’s App Store Connect Help:

- App name: max 30 characters
- Subtitle: max 30 characters
- Promotional text: max 170 characters
- Description: max 4000 characters
- Keywords: max 100 bytes
- Privacy Policy URL: required for iOS apps
- Support URL: required and must lead to actual contact information
- App Review contact and review notes: required for submission

Source references:

- App information: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/
- Platform version information: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
- Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications

## Recommended App Information

### Name

`Fakarni`

Length: 7 / 30

### Subtitle

`Voice reminders in seconds`

Length: 26 / 30

Alternative options:

- `Fast voice reminders`
- `Speak once, remember clearly`
- `Voice-first reminders`

### Primary Category

`Productivity`

### Secondary Category

`Utilities`

### Copyright

`2026 Mohamed Hosam`

Replace with the exact legal owner name you want shown on the product page.

## English Metadata

### Promotional Text

`Capture reminders by voice, confirm quickly, and stay on track with calm follow-ups, Siri shortcuts, and optional calendar sync.`

Length: 141 / 170

### Keywords

`voice,reminders,speech,productivity,calendar,notifications,arabic,english,siri`

Estimated length: 85 bytes

Notes:

- Don’t repeat `Fakarni`
- Don’t add competitor names
- Keep this as a single comma-separated string

### Description

`Fakarni is a voice-first reminder app built to capture a task quickly and handle the rest with less friction.

Speak naturally and turn a spoken thought into a clean reminder in seconds. If something is unclear, Fakarni asks for a quick confirmation instead of forcing you through a long manual form.

Fakarni is designed for real daily use:
- Voice capture first
- Fast reminder confirmation
- Today, Upcoming, and Overdue views
- Complete and Snooze actions
- One smart follow-up nudge when needed
- Siri shortcuts on iPhone
- Optional calendar saving

The product is especially tuned for Arabic-first use cases while also supporting English flows.

Fakarni is built for people who want reminders to feel lighter, faster, and more reliable than traditional reminder apps.`

## Arabic Localization

Arabic App Store localization is intentionally deferred for 1.0.
Keep the product page, screenshots, and review copy in English for this submission.

## Marketing URL, Support URL, Privacy Policy URL

These pages now have near-final repo drafts in `landing/`:

- Marketing URL candidate: host `landing/index.html`
- Support URL candidate: host `landing/support.html`
- Privacy Policy URL candidate: host `landing/privacy.html`

Live URLs:

- `https://fakarni.quantara.site/`
- `https://fakarni.quantara.site/support`
- `https://fakarni.quantara.site/privacy`

## App Review Information

### Review Contact

Fill these with real values before submission:

- Contact name: `TODO`
- Contact email: `info@quantara.site`
- Contact phone: `TODO`

### Sign-In Required

`No`

### App Review Notes Draft

`Fakarni is a voice-first reminder app. The core public flow is: onboarding, home voice capture, reminder confirmation, reminder list, settings, help, and speech failure handling.

Testing notes:
- No account creation or sign-in is required.
- The app requests microphone and speech recognition access only when the user starts voice capture.
- The app uses local notifications for reminder delivery.
- A Siri / Shortcuts voice-capture entry point is available on iPhone.
- Calendar access is optional and only used when the user enables calendar saving.
- If the submitted build includes a production parsing gateway, smart parsing routes through that gateway.
- If the submitted build does not include a production parsing gateway, reminder parsing stays on the local rules-first path and asks for confirmation when needed.

Recommended review path:
1. Launch the app and complete onboarding.
2. Tap the main microphone button and create a reminder by voice.
3. Review the confirmation screen and save the reminder.
4. Open the reminder list and test complete or snooze actions.
5. Optionally test the help/settings screens and calendar toggle flow.`

## Screenshot Plan

The app now ships as `iPhone-only`, so only iPhone screenshots are required for submission.

Apple currently requires iPhone screenshots, and if you do not provide a 6.9-inch set, a 6.5-inch set is required.

The detailed capture workflow now lives in `docs/app-store-screenshot-runbook.md`.

Recommended capture target:

- Use `6.9"` iPhone screenshots if available
- Portrait preferred for this app
- Prepare 5 screenshots

Accepted iPhone sizes from Apple:

- 6.9": `1290 x 2796` portrait or `1320 x 2868` portrait depending on device
- 6.5": `1284 x 2778` portrait or `1242 x 2688` portrait

Recommended screenshot sequence:

1. Onboarding or first voice capture screen
2. Main home screen with primary mic action
3. Confirmation flow after a parsed reminder
4. Reminder list showing Today / Upcoming / Overdue
5. Siri shortcut or settings/trust screen

Screenshot caption draft:

1. `Capture a reminder by voice in seconds`
2. `Speak once and let Fakarni structure the reminder`
3. `Confirm quickly when timing needs a review`
4. `Stay on top of what is due today`
5. `Launch from Siri when you need it fast`

## Remaining Human Inputs Needed

These are still required from you before this pack is truly submission-ready:

- Real support phone number or alternate support contact path
- Final legal/copyright owner name
- Final screenshot exports
- Final App Review contact name and phone number
