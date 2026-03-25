# VoiceGhost Memory

## Product Snapshot
VoiceGhost هو تطبيق تذكيرات voice-first مبني للعربية، هدفه أن يلتقط المهمة بصوت المستخدم بسرعة ثم يتكفل بباقي الرحلة: فهم الطلب، اقتراح الوقت والتنبيه، الحفظ، الإشعار، والمتابعة بعد الحفظ. الجمهور الحالي هو المستخدم المشغول الذي يريد طريقة أسرع وأكثر اعتمادًا من تطبيقات التذكير التقليدية، بدون احتكاك كثير أو شاشات معقدة.

## Current UX Direction
- الواجهة عربية أولًا، مع تقليل أي نص إنجليزي في المسارات الأساسية.
- الشاشة الرئيسية mic-first، وتوضّح في ثانيتين: اضغط وتكلم.
- الإدخال اليدوي موجود كحل بديل، وليس كمسار أساسي.
- الأولوية للاعتمادية والثقة أكثر من كثرة الميزات.
- قائمة التذكيرات تشغيلية: اليوم، القادم، والمتأخر بدل قائمة مسطحة.
- الحفظ يجب أن يبدو خفيفًا وسريعًا، مع أقل عدد ممكن من القرارات.
- الإعدادات تبدأ بما يهم المستخدم يوميًا، بينما الأدوات الداخلية تأتي متأخرة وبأولوية أقل.

## Shipped Features
### Core voice flow
- onboarding موجّه للصوت
- التقاط الكلام العربي وتحويله إلى draft
- inline confirmation سريع
- full confirmation عند الحاجة أو الغموض

### Reminder management
- إنشاء وتعديل وحذف التذكيرات
- قائمة تشغيلية مع Today / Upcoming / Overdue
- عرض التذكيرات المكتملة كحالة ثانوية
- recurrence يدعم none / daily / weekly / weekdays

### Follow-through loop
- `Done` و`Snooze` من داخل القائمة
- notification actions للتعامل مع التذكير من الإشعار
- follow-up retry واحد فقط عند عدم إنهاء التذكير
- إعدادات للتحكم في follow-up delay

### Calendar and integrations
- Apple Calendar auto-save على iOS
- Google Calendar integration على Android عند الربط
- fallback محترم إذا فشلت الصلاحيات أو الربط

### Founder analytics
- PostHog analytics مجهول
- founder dashboard داخل التطبيق
- instrumentation لرحلة الصوت، الإنشاء، الصلاحيات، والتقويم

## Current State
- تجربة home أصبحت voice-first وواضحة بصريًا.
- onboarding، home، settings، reminder list، وconfirmation متقاربين أكثر في النبرة والهدف.
- retention loop مطبق حاليًا: Done / Snooze / Today-Upcoming-Overdue / weekdays / follow-up واحد.
- Apple Calendar auto-save موجود على iOS.
- founder analytics مع PostHog موجودة داخل التطبيق.
- ما زال يحتاج تحققًا على جهاز حقيقي لسلوك notification actions، follow-up timing، وcalendar flows.
- ما زالت بعض الأسطح الداخلية تحمل نبرة developer-first أكثر من اللازم، لكنها ليست ضمن المسار الأساسي للمستخدم.

## Recent Decisions
- 2026-03-25: اعتماد `Founder memory` كملف مرجعي دائم في الجذر بدل changelog طويل، حتى يبقى أي handoff سريع وواضح.
- 2026-03-25: إبقاء الاشتراكات خارج الواجهة الحالية، لأن أولوية النسخة هي الاعتمادية والوضوح قبل monetization UI.
- 2026-03-25: جعل الإعدادات تبدأ بالأساسيات التي تمنع ضياع التذكير: الصوت، الإشعارات، المتابعة الذكية، ثم التقويم.
- 2026-03-25: ترسيخ manual creation كمسار بديل، لا كقيمة أساسية للمنتج.
- 2026-03-25: تحويل قائمة التذكيرات إلى view تشغيلية بدل أرشيف عام، لدعم follow-through اليومي.

## Next Priorities
- اختبار فعلي على جهاز حقيقي لـ notification actions وfollow-up timing وcalendar behavior.
- تنظيف اللغة المتبقية في الشاشات غير الأساسية وتوحيد tone of voice بالكامل.
- صقل بصري إضافي لقائمة التذكيرات وكروت الحالات لتبدو أخف وأكثر قربًا من iOS polish.
- مراجعة onboarding مرة أخيرة بعد اختبار مستخدمين للتأكد أن الرسالة تُفهم خلال ثانيتين.
- تجهيز App Store assets والنصوص وsubmission checklist.

## Founder Analytics
- PostHog مفعّل داخل التطبيق عبر environment variables محلية، مع founder dashboard للفحص السريع.
- لا يجب أبدًا تخزين project tokens أو أي secrets داخل هذا الملف.
- هذا الملف يذكّر بوجود analytics setup فقط، وليس مكانًا لتوثيق الأسرار.

## Update Rule
- أي turn يغيّر behavior أو product flow يجب أن يحدّث هذا الملف.
- عند كل تحديث، راجع على الأقل: `Current State` و`Recent Decisions` و`Next Priorities`.
- اكتب outcome على مستوى السلوك، لا على مستوى أسماء الملفات.
- لا تضف API keys أو tokens أو أي بيانات خاصة هنا.
