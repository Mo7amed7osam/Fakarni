# Fakarni App Store Metadata Pack

Last prepared: 2026-04-14

This file is the working draft for App Store Connect.
It is designed to be copied into App Store Connect with minimal editing.

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

`Capture reminders by voice, confirm quickly, and stay on track with calm follow-ups, Siri shortcuts, widget entry, and optional calendar sync.`

Length: 141 / 170

### Keywords

`voice,reminders,speech,productivity,calendar,notifications,arabic,english,siri,widget`

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
- Home screen widget entry
- Optional calendar saving

The product is especially tuned for Arabic-first use cases while also supporting English flows.

Fakarni is built for people who want reminders to feel lighter, faster, and more reliable than traditional reminder apps.`

## Optional Arabic Localization Draft

Use this only if you decide to localize the App Store listing in Arabic.

### Subtitle

`تذكيرات صوتية بسرعة`

### Promotional Text

`سجّل التذكير بصوتك، راجعه بسرعة، وخليك متابع من غير خطوات كثيرة أو تنبيهات مزعجة.`

### Description

`Fakarni هو تطبيق تذكيرات بالصوت، هدفه أن يلتقط ما تريد بسرعة ثم يتكفل بالباقي.

قل المهمة والوقت بطريقتك، وسيحوّلها التطبيق إلى تذكير واضح خلال ثوانٍ. وإذا كان هناك شيء غير واضح، يطلب منك مراجعة سريعة بدل أن يدخلك في شاشة طويلة ومعقدة.

مميزات التجربة:
- إدخال صوتي أولًا
- مراجعة سريعة عند الحاجة
- قوائم اليوم والقادم والمتأخر
- إجراءات سريعة مثل تم وغفوة
- نغزة متابعة واحدة بدل الإزعاج المتكرر
- اختصارات Siri
- ويدجت للمايك على الشاشة الرئيسية
- حفظ اختياري في التقويم

Fakarni مناسب للمستخدم الذي يريد تسجيل التذكير بسرعة وبطريقة واضحة وموثوقة.`

## Marketing URL, Support URL, Privacy Policy URL

These pages now have near-final repo drafts in `landing/`:

- Marketing URL candidate: host `landing/index.html`
- Support URL candidate: host `landing/support.html`
- Privacy Policy URL candidate: host `landing/privacy-policy.html`

Suggested final URL structure after hosting:

- `https://your-domain.com/`
- `https://your-domain.com/support`
- `https://your-domain.com/privacy`

Do not submit placeholder domains to Apple.

## App Review Information

### Review Contact

Fill these with real values before submission:

- Contact name: `TODO`
- Contact email: `TODO`
- Contact phone: `TODO`

### Sign-In Required

`No`

### App Review Notes Draft

`Fakarni is a voice-first reminder app. The core public flow is: onboarding, home voice capture, reminder confirmation, reminder list, settings, help, and speech failure handling.

Testing notes:
- No account creation or sign-in is required.
- The app requests microphone and speech recognition access only when the user starts voice capture.
- The app uses local notifications for reminder delivery.
- Siri shortcuts and the iPhone home-screen widget are optional entry points for voice capture.
- Calendar access is optional and only used when the user enables calendar saving.
- Smart parsing routes through a configured production parsing gateway.

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
5. Siri shortcut, widget, or settings/trust screen

Screenshot caption draft:

1. `Capture a reminder by voice in seconds`
2. `Speak once and let Fakarni structure the reminder`
3. `Confirm quickly when timing needs a review`
4. `Stay on top of what is due today`
5. `Launch from Siri, widget, and system surfaces`

## Remaining Human Inputs Needed

These are still required from you before this pack is truly submission-ready:

- Real hosted domain for support and privacy pages
- Real support email
- Real support phone number or alternate support contact path
- Final legal/copyright owner name
- Final screenshot exports
- Final decision on English-only vs localized Arabic App Store listing
