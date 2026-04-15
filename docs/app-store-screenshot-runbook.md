# Fakarni App Store Screenshot Runbook

Last prepared: 2026-04-14

This file turns the screenshot task into a repeatable workflow for the final App Store listing.

## Target

- Device scope: `iPhone-only`
- Preferred capture size: `6.9-inch iPhone`
- Backup capture size: `6.5-inch iPhone`
- Orientation: `Portrait`
- Recommended count: `5 screenshots`

## Screenshot Sequence

1. `Home / voice-first entry`
   Show the primary mic-first home screen in a calm idle state.

2. `Voice parse confirmation`
   Show a parsed reminder with the confirmation card visible.

3. `Reminder list`
   Show Today / Upcoming / Overdue in one clean operational view.

4. `Quick trust / notification state`
   Show the trust pack or saved reminder state that signals reliability.

5. `System entry point`
   Show either the Siri shortcut path or a clean settings/trust screen.

## Caption Drafts

1. `Capture a reminder by voice in seconds`
2. `Speak once and confirm quickly`
3. `Stay on top of today, upcoming, and overdue`
4. `Keep reminders reliable with calm follow-through`
5. `Launch from Siri when you need it fast`

## Visual Rules

- Use the final release build, not a dev menu or debug build with overlays.
- Keep language consistent across the set: English-only or Arabic-localized, not mixed.
- Use a near-real reminder example, not lorem ipsum.
- Avoid permission alerts, debug banners, network errors, or placeholder content in screenshots.
- Make sure the time, date, and reminder examples look intentional.

## Capture Workflow

1. Install the release candidate or a visually equivalent debug build on the iPhone simulator or physical iPhone.
2. Reset app state if needed so onboarding can be captured intentionally.
3. Move through the five required screens in order.
4. Capture portrait screenshots at the target device size.
5. Export, crop only if necessary, and verify the final pixel dimensions against Apple requirements.

## Suggested Reminder Examples

Use one coherent set instead of random examples:

- `Call Ahmed tomorrow at 10 AM`
- `Gym on Thursday at 7 PM`
- `Doctor appointment in 2 hours`

If you localize the listing in Arabic, use one coherent Arabic set instead.

## File Naming

Export screenshots with stable names:

- `01-home-voice-entry.png`
- `02-confirmation.png`
- `03-reminder-list.png`
- `04-trust-pack.png`
- `05-siri-or-settings.png`

## Current Status

Current status: `Capture workflow prepared`

Notes:

- the repo now has the exact sequence, caption plan, and naming convention
- a draft simulator subset now exists in `docs/app-store-screenshots-draft/`
- simulator automation may still require unsandboxed `xcrun simctl` access on the owner machine
- final App Store screenshots still need to be exported and uploaded
