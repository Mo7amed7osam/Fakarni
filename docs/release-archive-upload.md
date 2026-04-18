# Fakarni Release Archive And Upload Runbook

Last reviewed: 2026-04-19

This runbook covers the final release path for App Store delivery.
It assumes the metadata pack and real-device validation have already been completed.

## Prerequisites

- Apple Developer signing is configured in Xcode for the final team
- bundle identifier stays `com.mohamedhosam.voiceghostapp`
- version is `1.0.0`
- build number is `1` or the next unused value
- production public env values are loaded for the release build
- parsing gateway is live
- privacy policy and support URLs are publicly hosted

## 1. Clean Release Inputs

- confirm `app.json` version and build number are final
- confirm release env uses production values only
- run `npm run release:env-check`
- confirm no debug banners, dev launchers, or preview URLs remain

## 2. Open The Workspace

Use:

- `ios/Fakarni.xcworkspace`

Target scheme:

- `Fakarni`

## 3. Build A Release Archive

Recommended Xcode Organizer path:

1. Open the workspace in Xcode
2. Select a generic iOS device destination
3. Select scheme `Fakarni`
4. Product -> Archive

Command-line equivalent:

```bash
xcodebuild \
  -workspace ios/Fakarni.xcworkspace \
  -scheme Fakarni \
  -configuration Release \
  -destination "generic/platform=iOS" \
  archive \
  -archivePath build/Fakarni.xcarchive
```

## 4. Validate The Archive

In Xcode Organizer:

1. Select the new archive
2. Click `Validate App`
3. Fix signing, entitlement, or metadata issues before upload

Transporter may also be used after export, but Organizer validation is the most direct first pass.

## 5. Upload The Build

In Xcode Organizer:

1. Select the validated archive
2. Click `Distribute App`
3. Choose `App Store Connect`
4. Upload the build

Alternative:

- export the `.ipa`
- upload with Transporter

## 6. Post-Upload Verification

- confirm the new build appears in App Store Connect
- confirm processing completes
- attach the build to the app version metadata
- re-check privacy answers, review notes, and screenshot set

## Common Blockers

- signing team mismatch
- missing or expired provisioning profile
- build number already used
- release env not loaded in Xcode archive
- missing privacy/support URLs in App Store Connect
- archive succeeds but validation fails on metadata or entitlements

## Submission Status

Current status: `Archive succeeded locally`

Reason:

- the archive/upload runbook is now in-repo
- the actual archive command was attempted on 2026-04-14 after enabling team-based automatic signing
- `xcodebuild -allowProvisioningUpdates` completed a Release archive successfully on the configured owner machine
- Organizer validation, upload, and App Store Connect submission steps still remain
