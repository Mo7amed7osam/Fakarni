# Fakarni Memory

## Product Snapshot
Fakarni هو تطبيق تذكيرات voice-first مبني للعربية، هدفه أن يلتقط المهمة بصوت المستخدم بسرعة ثم يتكفل بباقي الرحلة: فهم الطلب، اقتراح الوقت والتنبيه، الحفظ، الإشعار، والمتابعة بعد الحفظ. الجمهور الحالي هو المستخدم المشغول الذي يريد طريقة أسرع وأكثر اعتمادًا من تطبيقات التذكير التقليدية، بدون احتكاك كثير أو شاشات معقدة.

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
- inline confirmation card دائم بعد كل parse ناجح
- full confirmation كشاشة تعديل ثانوية عند الضغط على `تعديل`

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
- يوجد الآن iPhone Home Screen widget صغير للمايك فقط، يفتح Fakarni عبر deep link إلى Home ويطلب بدء التسجيل تلقائيًا بدل إجبار المستخدم على فتح التطبيق ثم الوصول للمايك يدويًا.
- واجهة الـ widget نفسها أصبحت mic-only tile: بدون أي نص داخلها، فقط مايك مركزي واضح حتى تبدو أقرب لـ launch affordance نظيفة لا mini card.
- widget path أصبح يقيس `widget opened / attempted / succeeded / fallback`، ويعرض fallback هادئ داخل Home عند نقص الأذونات أو غياب locale أو فشل بدء التسجيل.
- يوجد الآن Siri entry على iOS عبر App Intents + App Shortcuts لحالتين: `Start Voice Capture` و`Create Reminder From Spoken Text`.
- مسار Siri يعيد استخدام نفس quick-capture والـ parser والـ confirmation الحالية: `siri_record` يبدأ التسجيل فور فتح التطبيق، و`siri_text` يمرر النص مباشرة إلى parse/save/review بدل اختراع flow جديد. في Siri text shortcut نفسه، Siri يطلب جملة التذكير كـ parameter بعد invocation بدل الاعتماد على phrase interpolation بنص حر.
- analytics الآن تميّز بين `siri_record` و`siri_text` عبر `siri shortcut invoked / launch attempted / launch succeeded / text parse completed / fallback shown`.
- تم إصلاح أخطاء Swift الأولية في Siri/App Intents وEventKit (`AppShortcutsProvider` و`EKAuthorizationStatus`)؛ المتبقي الآن في البناء المحلي مرتبط ببيئة Xcode/Storyboard والصلاحيات، لا بمنطق Siri نفسه.
- Home يحمل الآن `daily trust pack`: شريط صحة صلاحيات هادئ عند تعطل الإشعارات أو مزامنة التقويم، وبطاقة `محتاج حركة دلوقتي` للتذكير المستحق أو المتأخر مع `تم` و`غفوة` مباشرة.
- بطاقة `محتاج حركة دلوقتي` نفسها أصبحت أقرب للغة Fakarni: hierarchy أوضح، timing pill أنظف، وتصنيف ظاهر بشكل أخف بدل كارت تشغيلية خشنة.
- تم تنفيذ home-first trust redesign فعليًا: الشاشة الرئيسية الآن تركز بصريًا على البراند والمايك والمثال وأقرب تذكير فقط، مع تقليل العناصر الثانوية في وضع السكون.
- تم إدخال `Apple glass` بشكل مقصود على السطوح العائمة الأساسية عبر BlurView reusable، خصوصًا الهوم وconfirmation والملخصات الصغيرة، بدل تحويل التطبيق كله إلى blur ثقيل.
- Home الآن أخف بصريًا: الهيدر أخف، والمايك أوضح، ويوجد rotating example prompt قصير يشرح للمستخدم ماذا يقول بدون زحمة.
- شاشة التذكيرات أصبحت تحترم الـ safe area في الأعلى، لذلك العنوان والهيدر لم يعودا يدخلان تحت الـ status bar أو الـ Dynamic Island.
- شاشة التذكيرات فيها الآن زر رجوع صغير أعلى الشاشة مع fallback للعودة إلى الهوم لو لم يوجد stack back، حتى لا يشعر المستخدم أنه داخل صفحة فرعية بلا مخرج واضح.
- في وضع السكون لم يعد transcript/state ظاهرين بدون داعٍ؛ هذه الطبقات تظهر فقط أثناء الاستماع أو المعالجة أو المراجعة.
- أي voice parse ناجح يمر الآن على confirmation card أولًا، حتى عند انخفاض الثقة أو غياب اليوم/الوقت.
- إذا كان اليوم أو الوقت ناقصًا، يمكن إكماله الآن مباشرة من confirmation card عبر date/time pickers بدون فتح الشاشة الكاملة.
- confirmation card نفسها أصبحت أقرب إلى decision sheet هادئة: أوضح في البنية، أقل warning-heavy، وتعرض reminder timing كجزء مستقل بدل خلطه بالنصوص.
- بعد الحفظ من Home يظهر saved confirmation صغير مع `Undo` بدل feedback playful أو غامض.
- الـ undo على Home لم يعد خاصًا بإنشاء التذكير فقط؛ صار يعيد أيضًا `Done` و`Snooze` إلى الحالة السابقة فعليًا بدل toast شكلي.
- يوجد الآن `uiLanguage` داخل الإعدادات مع أساس جاهز للتبديل بين المصري والإنجليزي، مع توحيد جزء كبير من الشاشات الأساسية على نبرة مصرية أو English copy من مصدر واحد.
- اللغة المختارة أصبحت تؤثر أيضًا على أجزاء تشغيلية مثل share message، ghost replies، وعناوين/أزرار الإشعارات الجديدة.
- شاشة الإعدادات لم تعد تعرض `Internal tools` أو اختيار `Ghost personality` للمستخدم، وأي أدوات founder بقيت خلف المدخل المخفي فقط.
- التطبيق الآن مثبت على tone هادئ واحد بدل إعطاء المستخدم إعداد شخصية منفصل.
- Onboarding أصبح أقصر وأوضح: flow واحد `اتكلم -> نأكد -> نذكرك` مع مثال واحد بدل feature cards.
- Onboarding أصبح الآن من نفس عائلة الهوم بصريًا: خلفية هادئة، brand واضح، وكارت واحد أنظف بدل الشاشة ذات الطابع المنفصل عن بقية التطبيق.
- Copy الـ onboarding أصبحت أهدأ: لا يظهر `صوت أولًا` كشعار، والسطر تحت `Fakarni` صار `خليك فاكر`، وخطوة الـ flow الأخيرة أصبحت `نفكرك`.
- شاشة الإضافة اليدوية أصبحت أكثر compact: الأساسيات فقط تظهر أولًا في card واحدة، بينما التكرار/التصنيف/التقويم انتقلوا إلى `خيارات إضافية` قابلة للفتح.
- عرض التاريخ داخل حقول الإدخال وملخص وقت التنبيه أصبح مختصرًا وأهدأ مثل `الخميس 26 مارس` بدل الصيغة الطويلة الثقيلة.
- قائمة التذكيرات أصبحت أكثر تشغيلية: manual CTA أخف، status strip أصغر وأهدأ، والمكتمل collapsed افتراضيًا.
- active filter داخل شاشة التذكيرات لم يعد يعتمد على كتلة سوداء قاسية؛ صار يستخدم موف من نفس palette ليبقى أوضح وأكثر انسجامًا مع Fakarni.
- الإعدادات أصبحت أكثر trust-first: بدون hero تسويقي، ومع قسم أخير واضح للخصوصية/الدعم/الإصدار، وكروت أكثر هدوءًا وأقل developer-feel.
- parsing لم يعد عربي-first فقط: قواعد parser وspeech locale وLLM prompt صاروا يدعمون الإنجليزي بشكل أفضل، خصوصًا اليوم/الوقت/offset/recurrence.
- parser العربي الآن يفهم بشكل أفضل الأوامر المصرية المختصرة مثل `كلم احمد` و`روح الجيم` ويطبع العنوان إلى task form أوضح بدل حفظه بصياغة clipped غير مريحة.
- parser الآن يفهم أيضًا العبارات النسبية القريبة مثل `كمان دقيقتين` و`بعد 10 دقايق` ويفسرها كموعد الحدث نفسه في المستقبل، لا كـ offset قبل الحدث.
- parser الآن يرفع العبارات النسبية القصيرة جدًا مثل `كمان دقيقة` إلى أقرب دقيقة آمنة للأعلى بدل قصّها لأسفل، حتى لا تصطدم بحد الحفظ/الجدولة وتظهر للمستخدم كأن التطبيق فريز.
- إذا فشل auto-save داخل confirmation card، الكارت لم يعد يبدو متجمّدًا؛ يتحول فورًا إلى وضع مراجعة يدوي واضح بدل البقاء في حالة high-confidence مضللة.
- parsing لم يعد LLM-by-default: يوجد الآن gating واضح، cache محلي، gateway contract اختياري، وmini/strong model routing عند غياب الـ gateway.
- يوجد الآن parsing gateway فعلي داخل الريبو كخدمة Node صغيرة مع `/parse` و`/health` وserver-side cache وmini/strong model routing، بدل الاكتفاء بعقد توثيقي فقط.
- يوجد الآن English parser test harness خفيف داخل المشروع للتحقق السريع من جودة parsing بدون إضافة test stack ثقيل.
- يوجد الآن parser matrix بسيط للعربي والإنجليزي مع command واحد للتشغيل، ويغطي اليوم/الوقت/offset/recurrence وبعض حالات التصنيف.
- parser tests الآن تغطي أيضًا مسار `hybrid` نفسه: fallback عند فشل الـ LLM، نجاح merge، وحالة low-confidence التي تبقي confirmation مطلوبًا.
- أيقونة الإعدادات في الهوم أصبحت أقرب لذهنية iOS gear المعتادة حتى تكون أوضح للمستخدم من الرسم القديم.
- يوجد `ads config` محلي founder-only لتجهيز منطق التحكم في الإعلانات قبل تركيب أي ad SDK فعلي، بدون إظهاره للمستخدم النهائي داخل الإعدادات العامة.
- أصول البراند الأساسية الآن تحمل حرف `F` واضح لـ `Fakarni` عبر app icon وsplash وadaptive icons وfavicon، بدل العلامة القديمة التي لم تكن تلتقط الاسم الجديد بصريًا.
- onboarding، home، settings، reminder list، وconfirmation متقاربين أكثر في النبرة والهدف.
- retention loop مطبق حاليًا: Done / Snooze / Today-Upcoming-Overdue / weekdays / follow-up واحد.
- Apple Calendar auto-save موجود على iOS.
- Apple Calendar auto-save على iOS صار يستخدم same-time alarm مطلق عند `startDate` نفسه عندما يكون offset التذكير `0`، لأن `relativeOffset = 0` لم يكن يظهر دائمًا كـ visible alert داخل الحدث.
- منطق calendar alerts أصبح موحدًا عبر Apple Calendar وdevice calendar وGoogle-backed calendar: `0` يعني alert في نفس الوقت، وأي offset موجب يعني alert قبل الحدث بنفس الدقائق التي اختارها المستخدم.
- مسار Apple Calendar على iOS عاد يعتمد على native EventKit bridge فعلي داخل مشروع Xcode، بدل وجود JS layer وحدها بدون module مسجل.
- founder analytics مع PostHog موجودة داخل التطبيق.
- ما زال يحتاج تحققًا على جهاز حقيقي لسلوك notification actions، follow-up timing، وcalendar flows.
- ما زال يحتاج تحققًا على iPhone حقيقي لسلوك Siri shortcuts الفعلي من Siri وShortcuts app، خصوصًا handoff بين App Intents وفتح التطبيق والبدء الفوري للتسجيل.
- ما زالت بعض الأسطح الداخلية تحمل نبرة developer-first أكثر من اللازم، لكنها ليست ضمن المسار الأساسي للمستخدم.

## Recent Decisions
- 2026-03-26: إصلاح صياغة `AppShortcutsProvider` وتغطية حالة `authorized` القديمة في EventKit، لأن أول build محلي توقف على أخطاء compile مباشرة في Siri وApple Calendar bridge.
- 2026-03-26: إضافة Siri entry على iOS عبر App Intents + App Shortcuts بدل أي SiriKit legacy path، لأن المطلوب surface حديثة وخفيفة تعيد استخدام منطق التطبيق نفسه بدل خلق مسار native منفصل.
- 2026-03-26: إبقاء Siri v1 thin layer فقط: `open and record` و`pass spoken text to app`، لأن القيمة هنا في تسريع الدخول للصوت لا في تكرار parser أو reminder logic داخل Swift.
- 2026-03-26: تحويل same-time Apple Calendar alerts إلى `absoluteDate = startDate` بدل `relativeOffset = 0`، لأن الحدث كان أحيانًا يُحفظ بلا alert ظاهر رغم اختيار التوقيت نفسه.
- 2026-03-26: إضافة iPhone Home Screen mic widget صغير يفتح Home ويبدأ التسجيل تلقائيًا عبر deep link، لأن أسرع UX مناسب لـ Fakarni هو `touch mic, speak, done`.
- 2026-03-26: إبقاء widget v1 stateless وmic-only مع fallback داخل Home بدل أي widget ذكي أو shared data، لأن الهدف تقليل الاحتكاك لا خلق سطح موازي معقّد.
- 2026-03-26: تبسيط واجهة الـ widget إلى mic-only tile بلا أي نص أو branding داخل الـ tile نفسها، لأن الشكل النصي السابق كان أقرب لكارت صغير لا لزر دخول سريع.
- 2026-03-26: توحيد calendar alert semantics على كل providers بحيث `offsetMinutes` هو source of truth دائمًا، لأن بعض المسارات كانت تعتبر `0` كأنه بلا alert بينما المطلوب same-time alert.
- 2026-03-26: ضغط شاشة الإضافة اليدوية إلى core card + more options لأن الـ scroll الطويل كان يضعف الإحساس بالسرعة والوضوح في المسار اليدوي.
- 2026-03-26: اعتماد formatter مختصر للتاريخ في حقول التأكيد بدل الصيغة الكاملة، لأن التاريخ الطويل كان ثقيلًا بصريًا وغير رايق.
- 2026-03-26: تقريب مواعيد relative-future القصيرة للأعلى لا للأسفل داخل parser، لأن `كمان دقيقة` كانت تفقد جزءًا من الدقيقة عند normalization ثم تفشل في auto-save.
- 2026-03-26: جعل Apple Calendar event يضيف alarm عند نفس وقت الحدث عندما يكون reminder offset = 0، لأن الحفظ كان يتم أحيانًا كحدث صامت بلا alert داخل Calendar.
- 2026-03-26: إضافة `daily trust pack` على Home عبر Due Now card وشريط صحة صلاحيات وundo حقيقي للـ quick actions، لأن الثقة اليومية تحتاج surface تشغيلية صغيرة أوضح من مجرد summary سلبي.
- 2026-03-26: إعادة native bridge الخاص بـ Apple Calendar داخل مشروع iOS نفسه، لأن toggle الإعدادات كان يشير إلى module غير موجود وبالتالي لا يطلب الإذن أصلًا.
- 2026-03-26: إضافة زر رجوع صغير أعلى شاشة التذكيرات، لأن المسار كان يحتاج affordance واضح وسريع للرجوع بدل الاعتماد على gesture أو stack فقط.
- 2026-03-26: استبدال active state الأسود في فلاتر شاشة التذكيرات بموف من نفس palette، لأن الأسود كان حادًا ومقطوعًا عن بقية اللغة البصرية.
- 2026-03-26: حذف `صوت أولًا` من onboarding واستبداله بسطر أهدأ `خليك فاكر` تحت البراند، لأن الشعار القديم لم يكن رايقًا ولا منسجمًا مع نبرة المنتج.
- 2026-03-26: إعادة تصميم onboarding ليتماشى بصريًا مع Fakarni بدل الشكل السابق الذي كان يبدو منفصلًا عن باقي التطبيق في اللون والإحساس العام.
- 2026-03-26: استبدال أصول الأيقونة القديمة بعلامة `F` واضحة لـ `Fakarni` وتوليدها بسكربت داخل المشروع، لأن البراند الظاهر للمستخدم كان تغيّر بينما الأيقونة ما زالت تحمل هوية قديمة وغير مقروءة.
- 2026-03-26: تغليف شاشة التذكيرات بـ safe area فعلي في الأعلى، لأن الهيدر كان يدخل تحت الـ status bar على الأجهزة ذات الـ notch ويكسر قابلية القراءة.
- 2026-03-26: إضافة parsing gateway فعلي داخل الريبو بذاكرة cache داخلية وmini/strong routing، حتى يصبح فصل provider keys عن التطبيق خطوة تشغيلية واضحة بدل مجرد plan.
- 2026-03-26: تحويل parsing إلى rules-first مع LLM gating واضح وcache محلي وgateway contract اختياري، لأن استدعاء الـ LLM بشكل شبه دائم كان يرفع التكلفة بدون قيمة مماثلة.
- 2026-03-26: اعتماد `rules_only | cache_hit | mini_model | strong_model | review_required` كمسارات parse قابلة للقياس، حتى يصبح خفض التكلفة والدقة الفعلية قابلين للرصد لا للحدس فقط.
- 2026-03-26: اعتماد تفسير `كمان دقيقتين` و`بعد 10 دقايق` كموعد حدث مستقبلي نفسه، وليس كتذكير قبل حدث ضمني، لأن هذا أقرب لفهم المستخدم ويمنع الانهيار في المواعيد القريبة جدًا.
- 2026-03-26: جعل فشل inline auto-save ينزل confirmation card إلى review mode بدل الإحساس بالفريز، لأن المشكلة كانت في recovery state أكثر من كونها في الواجهة وحدها.
- 2026-03-26: اعتماد glass treatment حقيقي عبر `expo-blur` في السطوح العائمة الأساسية فقط، لأن المطلوب كان Apple feel نظيفًا لا مؤثرًا زخرفيًا زائدًا على كل الشاشات.
- 2026-03-26: تنفيذ home-first trust redesign على مستوى hierarchy لا مجرد copy، لأن المنتج كان يحتاج أن تصبح الشاشة الرئيسية هي الواجهة الفعلية للثقة وليس مجرد شاشة ضمن عدة شاشات متنافسة.
- 2026-03-26: إخفاء transcript/state عن وضع السكون في Home، لأن وجودها دائمًا كان يضيف شرحًا بصريًا زائدًا ويضعف حضور المايك.
- 2026-03-26: تهدئة confirmation card وSectionCard وGhostButton بصريًا، لأن النظام كان يحتاج أن يبدو أدق وأهدأ وأكثر قربًا من system UI قبل الإطلاق.
- 2026-03-26: تغيير اسم البراند الظاهر للمستخدم من `VoiceGhost` إلى `Fakarni` عبر الشاشات والإشعارات واسم التطبيق، مع إبقاء المعرفات التقنية الحالية كما هي لتجنب كسر OAuth أو الربط الأصلي.
- 2026-03-26: تحسين فهم الأوامر المصرية المختصرة في parser والـ LLM معًا، لأن الاعتماد على prompt فقط لم يكن كافيًا لحالات مثل `كلم احمد` و`روح الجيم`.
- 2026-03-26: استبدال أيقونة الإعدادات المرسومة يدويًا بشكل أوضح أقرب لذهنية iOS gear، لأن التعرف السريع على زر الإعدادات أهم من uniqueness البصرية هنا.
- 2026-03-26: تنفيذ UX compression pass قبل الإطلاق: تقليل الزينة، توضيح الأمثلة، وتغيير feedback بعد الحفظ إلى saved + undo، لأن المنتج كان يحتاج ثقة وسرعة أكثر من مزيد من العناصر.
- 2026-03-26: إزالة `Internal tools` و`Ghost personality` من شاشة الإعدادات العامة وتثبيت tone التطبيق على وضع هادئ واحد، لأن هذه الخيارات كانت تضيف تعقيدًا غير ضروري وتكشف أشياء ليست للمستخدم.
- 2026-03-26: نقل `ads controls` من شاشة الإعدادات العامة إلى Founder Dashboard فقط، لأن ظهور إعدادات monetization الداخلية للمستخدم يضعف الثقة ويشوّش المسار الأساسي.
- 2026-03-26: إضافة language setting وبداية طبقة copy موحدة للمصري والإنجليزي، لتجنب خلط الفصحى بالمصري وتجهيز تحويل الواجهة للإنجليزي عند الحاجة.
- 2026-03-26: توسيع طبقة اللغة لتشمل الإشعارات والرسائل والردود الجاهزة، حتى لا يظل التبديل للإنجليزي جزئيًا أو سطحيًا.
- 2026-03-26: تحسين English parsing في القواعد المحلية والـ LLM prompt وربط speech recognition locale بلغة التطبيق، لأن التبديل للإنجليزي كان ضعيفًا وظيفيًا وليس بصريًا فقط.
- 2026-03-26: إضافة parser tests إنجليزي مباشر بـ Node test runner وTypeScript hook بسيط، حتى يبقى أي regression ظاهر بسرعة.
- 2026-03-26: توسيع parser tests لتشمل المصري أيضًا، مع إصلاح stripMeta للعناوين التي تحتوي على يوم أسبوع بالعربي.
- 2026-03-26: إضافة hybrid parser smoke tests عبر mock للـ LLM module، حتى يصبح سلوك merge نفسه تحت الاختبار بدل الاكتفاء بـ rules parser.
- 2026-03-26: إضافة ads config داخل settings بدل ربط الإعلانات مباشرة في الشاشات، حتى يظل التحكم في monetization behavior من عند المؤسس.
- 2026-03-26: إضافة date/time pickers داخل confirmation card لإكمال اليوم أو الوقت الناقصين، حتى تبقى التجربة خفيفة ومألوفة مثل بقية التطبيقات بدون فرض الشاشة الكاملة.
- 2026-03-25: اعتماد card-first confirmation دائم بعد الصوت بدل فتح الفورم تلقائيًا، حتى تبقى التجربة سريعة وغير مزعجة مع الحفاظ على طريق تعديل واضح.
- 2026-03-25: اعتماد `Founder memory` كملف مرجعي دائم في الجذر بدل changelog طويل، حتى يبقى أي handoff سريع وواضح.
- 2026-03-25: إبقاء الاشتراكات خارج الواجهة الحالية، لأن أولوية النسخة هي الاعتمادية والوضوح قبل monetization UI.
- 2026-03-25: جعل الإعدادات تبدأ بالأساسيات التي تمنع ضياع التذكير: الصوت، الإشعارات، المتابعة الذكية، ثم التقويم.
- 2026-03-25: ترسيخ manual creation كمسار بديل، لا كقيمة أساسية للمنتج.
- 2026-03-25: تحويل قائمة التذكيرات إلى view تشغيلية بدل أرشيف عام، لدعم follow-through اليومي.

## Next Priorities
- اختبار Siri shortcuts على iPhone حقيقي: invocation phrases، فتح التطبيق، auto-start للتسجيل، وتمرير النص إلى parse/review path.
- اختبار widget على iPhone حقيقي: launch من Home Screen، auto-start، وسلوك fallback عند غياب الأذونات.
- اختبار فعلي على جهاز حقيقي لـ notification actions وfollow-up timing وcalendar behavior.
- نشر parsing gateway الجديد وربط `EXPO_PUBLIC_PARSE_GATEWAY_URL` به، حتى تخرج provider keys من التطبيق نهائيًا.
- مراجعة Home وConfirmation على جهاز حقيقي لضبط الإحساس بالحجم والمسافات وسلوك Daily Trust Pack.
- تنظيف اللغة المتبقية في الشاشات غير الأساسية وتوحيد tone of voice بالكامل.

## Founder Analytics
- PostHog مفعّل داخل التطبيق عبر environment variables محلية، مع founder dashboard للفحص السريع.
- لا يجب أبدًا تخزين project tokens أو أي secrets داخل هذا الملف.
- هذا الملف يذكّر بوجود analytics setup فقط، وليس مكانًا لتوثيق الأسرار.

## Update Rule
- أي turn يغيّر behavior أو product flow يجب أن يحدّث هذا الملف.
- عند كل تحديث، راجع على الأقل: `Current State` و`Recent Decisions` و`Next Priorities`.
- اكتب outcome على مستوى السلوك، لا على مستوى أسماء الملفات.
- لا تضف API keys أو tokens أو أي بيانات خاصة هنا.
