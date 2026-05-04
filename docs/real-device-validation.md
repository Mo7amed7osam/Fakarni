# Fakarni Real-Device Validation

Last reviewed: 2026-04-14

This checklist is for one physical iPhone running the exact release candidate build.
Do not treat simulator coverage as a substitute for this list.

## Test Device Record

- Device model: `TODO`
- iOS version: `TODO`
- Build version: `1.0.0 (1)`
- Install source: `TestFlight / Xcode / Ad Hoc`
- Tester: `TODO`
- Date: `TODO`

## Pass Criteria

- No crash in onboarding, capture, confirm, save, edit, snooze, complete, or settings flows
- Voice capture creates valid reminders in both English and Arabic smoke tests
- Local notifications fire at the expected time
- Optional calendar write flow works when enabled and fails cleanly when denied
- Settings-based permission recovery works without leaving the app in a broken state

## Validation Cases

### 1. First Launch

- Install the release candidate fresh
- Launch the app
- Confirm onboarding appears only once
- Confirm no unexpected permission prompt appears before user action
- Result: `PASS / FAIL`
- Notes: `TODO`

### 2. Permission Timing

- Start voice capture
- Confirm microphone and speech prompts appear only when capture starts
- Save one reminder and confirm notification permission prompt timing is reasonable
- Open calendar sync flow and confirm calendar permission appears only when needed
- Result: `PASS / FAIL`
- Notes: `TODO`

### 3. Voice Reminder Creation

- Create one reminder in English
- Create one reminder in Arabic
- Create one reminder with an ambiguous time that requires confirmation
- Confirm the saved reminder content matches expected title and time
- Result: `PASS / FAIL`
- Notes: `TODO`

### 4. Reminder Lifecycle

- Edit a reminder
- Mark a reminder complete
- Snooze a reminder
- Undo or recover from the latest action if the UI offers it
- Confirm Today, Upcoming, and Overdue sections update correctly
- Result: `PASS / FAIL`
- Notes: `TODO`

### 5. Notification Delivery

- Save a near-term reminder
- Background the app
- Wait for the local notification
- Trigger notification action paths if available
- Re-open the app and confirm state is correct
- Result: `PASS / FAIL`
- Notes: `TODO`

### 6. Duplicate Notification Check

- Create a reminder
- Foreground and background the app several times
- Reboot the app once
- Confirm only one notification fires for the reminder
- Result: `PASS / FAIL`
- Notes: `TODO`

### 7. Settings / Permission Recovery

- Deny one relevant permission once
- Open the app settings from the in-app recovery path
- Return to the app and confirm state, messaging, and next actions are still valid
- Result: `PASS / FAIL`
- Notes: `TODO`

### 8. Calendar Sync

- Enable calendar save
- Save a reminder that should create a calendar event
- Deny permission once and confirm the app handles it cleanly
- Re-enable permission and confirm the flow succeeds
- Result: `PASS / FAIL`
- Notes: `TODO`

### 9. Background / Resume Stability

- Create a reminder
- Lock the phone
- Unlock and reopen later
- Force-quit and relaunch
- Confirm reminders, permissions, and settings persist correctly
- Result: `PASS / FAIL`
- Notes: `TODO`

## Defect Logging Format

When something fails, record:

- short title
- exact steps
- expected result
- actual result
- screenshot or screen recording path
- device and iOS version
- whether it blocks submission

## Submission Status

Current status: `Not executed`

Reason:

- this checklist now exists in-repo
- it still must be run on a real iPhone before App Store submission
