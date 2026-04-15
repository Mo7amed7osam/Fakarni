# Fakarni Release Owner Punch List

Last prepared: 2026-04-14

This file contains only the remaining owner actions after the repo-side release fixes already applied in code and Xcode config.

## Already Fixed In Repo

- iPhone-only device scope is now aligned in Expo config and Xcode target settings.
- Xcode target `Fakarni` now has a configured development team and automatic signing enabled.
- Release versioning is aligned at `1.0.0 (1)`.
- Release docs, metadata draft, privacy manifest, privacy answer sheet, screenshot runbook, and real-device validation runbook are in place.
- Production parsing remains gateway-only on the client.

## Remaining Owner Actions

1. Validate and upload the archive.
   Use Xcode Organizer `Validate App`, then upload to App Store Connect.

2. Host real public support and privacy pages.
   Confirm `https://fakarni.quantara.site/support` and `https://fakarni.quantara.site/privacy` stay live and use those URLs in App Store Connect.

3. Complete App Store Connect metadata.
   Fill review contact, support URL, privacy URL, copyright owner, final description, keywords, subtitle, and review notes.

4. Export final iPhone screenshots.
   Start from the draft captures in `docs/app-store-screenshots-draft/`, then finish the final 5-shot set defined in `docs/app-store-screenshot-runbook.md` and upload it to App Store Connect.

5. Set production release environment values.
   Provide a live `EXPO_PUBLIC_PARSE_GATEWAY_URL` and confirm the intended PostHog production host/key, or disable analytics for release.

6. Rotate any previously exposed provider secrets.
   Do this if any model/provider keys were ever used in client builds, commits, or screenshots.

7. Run the physical iPhone validation pass.
   Complete every case in `docs/real-device-validation.md`, especially notifications, Siri / Shortcuts launch, calendar write flow, and Arabic/English smoke coverage.

8. Confirm App Privacy answers in App Store Connect.
   Use `docs/app-store-privacy-answers.md` and match the shipped behavior: local reminder data, optional calendar sync, optional anonymous analytics, and optional remote parsing through the gateway.

## Submission Gate

Do not submit until all 8 owner actions above are complete.
