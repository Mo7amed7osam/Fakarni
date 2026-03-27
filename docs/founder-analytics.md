# VoiceGhost Founder Analytics

## Environment

Add these variables to your local `.env` and production environment:

```bash
EXPO_PUBLIC_POSTHOG_KEY=phc_your_project_key
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

For the current VoiceGhost project:

```bash
EXPO_PUBLIC_POSTHOG_KEY=phc_gqHV7c6YVnpOuHrFmyxZXAShBEcCWGVYS2ALhqa43Cc
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

`Project ID = 356580` is only needed for PostHog API/admin usage. The mobile SDK uses the project token, not the project ID.

If `EXPO_PUBLIC_POSTHOG_KEY` is missing, the app still records events in the hidden founder diagnostics screen, but nothing is sent to PostHog Cloud.

## Hidden Dashboard

- Open `Settings`
- Tap the settings title or version chip `7` times quickly
- This opens the in-app founder diagnostics screen

The hidden screen shows:

- analytics enabled state
- PostHog host and distinct ID
- buffered event estimate and flush state
- local reminder scorecard
- install and first-use milestones
- last 20 tracked events

## Event Catalog

Implemented now:

- `app opened`
- `onboarding completed`
- `screen viewed`
- `microphone tapped`
- `voice listening started`
- `voice listening ended`
- `voice transcript captured`
- `reminder parse succeeded`
- `reminder parse failed`
- `reminder confirmation shown`
- `reminder inline auto-save triggered`
- `reminder create succeeded`
- `reminder create failed`
- `reminder updated`
- `reminder deleted`
- `notification permission requested`
- `notification permission changed`
- `notification scheduled`
- `calendar sync attempted`
- `calendar sync succeeded`
- `calendar sync failed`
- `apple calendar auto-sync toggled`
- `google calendar connected`
- `google calendar disconnected`
- `settings changed`
- `feedback prompt shown`
- `feedback prompt answered`
- `feedback sentiment selected`
- `feedback submitted`
- `app review requested`
- `share suggested`

Reserved for later subscriptions:

- `paywall viewed`
- `paywall plan selected`
- `trial started`
- `subscription started`
- `subscription renewed`
- `subscription canceled`
- `subscription billing failed`

## Privacy Rules

- Raw transcript text is never sent
- Reminder title is never sent
- Only derived metadata is sent, such as category, recurrence, confidence bucket, permission state, and calendar mode
- Users can disable anonymous analytics from Settings

## Founder Dashboards To Create In PostHog

### 1. North Star

- Metric: unique users performing `reminder create succeeded`
- Metric: total `reminder create succeeded`
- Breakdown: `entry_point`
- Breakdown: `category`

### 2. Activation Funnel

Build a funnel:

1. `app opened`
2. `microphone tapped`
3. `voice transcript captured`
4. `reminder parse succeeded`
5. `reminder create succeeded`

Filter out `build_channel = dev` if you do not want internal usage.

### 3. Voice Quality

- Trend: `reminder parse succeeded`
- Trend: `reminder parse failed`
- Breakdown: `parse_confidence_bucket`
- Breakdown: `missing_time`
- Breakdown: `missing_date`
- Breakdown: `confirmation_mode`

### 4. Reliability

- Trend: `notification permission changed`
- Trend: `notification scheduled`
- Trend: `calendar sync failed`
- Trend: `calendar sync succeeded`
- Trend: `$exception`

### 5. Monetization Readiness

- Trend: `reminder create succeeded`
- Breakdown: users with high creation frequency
- Breakdown: `calendar_mode`
- Breakdown: `recurrence`
- Create cohorts for users with 3+, 7+, and 15+ successful reminder creations

## Suggested Cohorts

- `new activated users`: users who triggered `reminder create succeeded` for the first time in the last 7 days
- `voice-first retained users`: users with 2+ `reminder create succeeded` events where `entry_point = voice_home`
- `power users likely to convert`: users with 7+ `reminder create succeeded` events in the last 14 days
- `users blocked by permissions`: users with `notification permission changed` absent and reminders that stay in permission-required state
