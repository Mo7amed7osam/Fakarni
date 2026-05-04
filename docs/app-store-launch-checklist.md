# Fakarni App Store Launch Checklist

Last reviewed: 2026-04-19

This is a strict go/no-go checklist for the iOS App Store build.
Every `NO-GO` item must be cleared before submission.

## Product And Review Surface

- `GO` The public app flow is reminder-focused only: onboarding, home, confirmation, reminder list, settings, help, and speech failure screens.
- `GO` The marketing landing page is no longer embedded in the Expo app shell. Any landing work now lives outside the app target in `landing/`.
- `GO` Hidden founder diagnostics are removed from public navigation and settings entry points.
- `GO` The app no longer ships Expo dev-client/dev-launcher configuration in the iOS target.
- `GO` Device scope is now aligned to iPhone-only in both Expo config and Xcode target settings.
- `GO` A draft metadata pack now exists in `docs/app-store-metadata-pack.md`.
- `GO` The 1.0 listing posture is now locked to `English-only`.
- `GO` Publishable support and privacy pages now exist and are hosted at `https://fakarni.quantara.site/support` and `https://fakarni.quantara.site/privacy`.
- `NO-GO` The hosted support/privacy URLs still need to be entered in App Store Connect alongside the rest of the final metadata.
- `NO-GO` Final screenshots still need to be exported and the final metadata needs to be entered in App Store Connect.

## Security And Privacy

- `GO` The app has an iOS privacy manifest at `ios/Fakarni/PrivacyInfo.xcprivacy`.
- `GO` A draft App Privacy answer sheet now exists in `docs/app-store-privacy-answers.md`.
- `GO` The app does not include ATT / IDFA tracking code.
- `GO` Direct client-side LLM provider calls are disabled. Remote parsing is optional and requires `EXPO_PUBLIC_PARSE_GATEWAY_URL`.
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
- `GO` The repo-side signing config is now set to team-based automatic signing for target `Fakarni`.
- `GO` A full Release archive build now succeeds with `xcodebuild -allowProvisioningUpdates` on the configured owner machine.
- `NO-GO` Final App Store upload validation must be run from Xcode Organizer or Transporter.
- `GO` Current archive state: Release archive completed successfully after enabling automatic signing and provisioning updates.

## Real Device Validation

- `GO` A device validation runbook now exists in `docs/real-device-validation.md`.
- `GO` An App Store screenshot runbook now exists in `docs/app-store-screenshot-runbook.md`.
- `NO-GO` Test voice capture end-to-end on a real iPhone.
- `NO-GO` Test reminder creation, edit, complete, snooze, and undo on a real iPhone.
- `NO-GO` Test notification delivery, notification actions, and follow-up timing on a real iPhone.
- `NO-GO` Confirm duplicate notifications do not appear after repeated foreground/background cycles.
- `NO-GO` Test settings-based permission recovery on a real iPhone.
- `NO-GO` Test Apple Calendar save flow and permission edge cases on a real iPhone.
- `NO-GO` Run one Arabic smoke test and one English smoke test on a real iPhone.

## Release Configuration

- `GO` The production-safe parsing posture is now explicit: use the production parsing gateway only when it is verified healthy, otherwise ship the local rules-first path.
- `GO` App config now includes explicit release identifiers: `version 1.0.0`, `ios.buildNumber 1`, `android.versionCode 1`.
- `GO` A release environment contract now exists in `docs/release-environment-matrix.md`.
- `GO` A release env verification script now exists at `npm run release:env-check`.
- `GO` A release archive/upload runbook now exists in `docs/release-archive-upload.md`.
- `NO-GO` If `EXPO_PUBLIC_PARSE_GATEWAY_URL` is present in the submitted build, it must point to a live production gateway.
- `NO-GO` Production analytics host/key configuration must be verified before release.
- `NO-GO` Confirm there are no debug-only env vars or staging endpoints in the release build.

## Submission Decision

- `GO` means the repo-side implementation is in acceptable shape.
- `NO-GO` means submission is still blocked until the manual or release-specific step is completed.

Current decision: `NO-GO for App Store submission` until the remaining manual, real-device, and release checks are completed.
