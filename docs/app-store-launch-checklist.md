# Fakarni App Store Launch Checklist

Last reviewed: 2026-04-14

This is a strict go/no-go checklist for the iOS App Store build.
Every `NO-GO` item must be cleared before submission.

## Product And Review Surface

- `GO` The public app flow is reminder-focused only: onboarding, home, confirmation, reminder list, settings, help, and speech failure screens.
- `GO` The marketing landing page is no longer embedded in the Expo app shell. Any landing work now lives outside the app target in `landing/`.
- `GO` Hidden founder diagnostics are removed from public navigation and settings entry points.
- `GO` The app no longer ships Expo dev-client/dev-launcher configuration in the iOS target.
- `NO-GO` A real public privacy policy URL must exist in App Store Connect.
- `NO-GO` Support URL and App Store metadata still need to be completed outside the repo.
- `NO-GO` Final screenshots, app description, keywords, and review notes still need to be prepared outside the repo.

## Security And Privacy

- `GO` The app has an iOS privacy manifest at `ios/Fakarni/PrivacyInfo.xcprivacy`.
- `GO` The app does not include ATT / IDFA tracking code.
- `GO` Direct client-side LLM provider calls are disabled. Smart parsing now requires `EXPO_PUBLIC_PARSE_GATEWAY_URL`.
- `NO-GO` Any previously exposed provider keys should be rotated before release if they were ever used in builds or commits.
- `NO-GO` Confirm the App Privacy nutrition labels in App Store Connect match actual behavior:
  reminder data stored locally, optional calendar sync, optional anonymous analytics, optional remote parsing through gateway.

## Permissions And Entitlements

- `GO` Microphone, speech recognition, and calendar usage descriptions exist in app config and Info.plist.
- `GO` Dev-launcher local-network/Bonjour keys are removed from the shipping iOS plist.
- `GO` The unused push entitlement was removed from the target because the app uses local notifications only.
- `NO-GO` Verify permission prompts on a real iPhone match the product behavior and do not appear unexpectedly.

## Build Health

- `GO` `npm run typecheck`
- `GO` `npm run test:parser`
- `GO` `npm run test:gateway`
- `NO-GO` A full Release archive build must succeed on the final signing setup.
- `NO-GO` Final App Store upload validation must be run from Xcode Organizer or Transporter.

## Real Device Validation

- `NO-GO` Test voice capture end-to-end on a real iPhone.
- `NO-GO` Test reminder creation, edit, complete, snooze, and undo on a real iPhone.
- `NO-GO` Test notification delivery, notification actions, and follow-up timing on a real iPhone.
- `NO-GO` Confirm duplicate notifications do not appear after repeated foreground/background cycles.
- `NO-GO` Test Siri shortcuts on a real iPhone.
- `NO-GO` Test the iPhone home-screen widget launch and fallback behavior on a real iPhone.
- `NO-GO` Test Apple Calendar save flow and permission edge cases on a real iPhone.
- `NO-GO` Run one Arabic smoke test and one English smoke test on a real iPhone.

## Release Configuration

- `GO` The production-safe parsing path is gateway-only.
- `GO` App config now includes explicit release identifiers: `version 1.0.0`, `ios.buildNumber 1`, `android.versionCode 1`.
- `NO-GO` `EXPO_PUBLIC_PARSE_GATEWAY_URL` must point to a live production gateway before release.
- `NO-GO` Production analytics host/key configuration must be verified before release.
- `NO-GO` Confirm there are no debug-only env vars or staging endpoints in the release build.

## Submission Decision

- `GO` means the repo-side implementation is in acceptable shape.
- `NO-GO` means submission is still blocked until the manual or release-specific step is completed.

Current decision: `NO-GO for App Store submission` until the remaining manual, real-device, and release-signing checks are completed.
