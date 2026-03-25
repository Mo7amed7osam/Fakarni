import { GhostMode, Reminder, ReminderCategory, ReminderDraft, UiLanguage } from '../types';
import { getReminderCategoryLabel } from './categorization';
import { relativeReminderLabel, toArabicDateTimeLabel } from './arabic';

type ReplyInput = {
  mode: GhostMode;
  title: string;
  category: ReminderCategory;
  recurrence: Reminder['recurrence'] | ReminderDraft['recurrence'];
  language?: UiLanguage;
};

const modeLabels: Record<GhostMode, string> = {
  sassy: 'الساخر',
  coach: 'المدرب',
  mom: 'الأم القلوقة',
  calm: 'الهادي',
};

const categoryRoasts: Partial<Record<ReminderCategory, string[]>> = {
  study: ['الكتاب مستنيك اهو.', 'المذاكرة مش هتخلص لوحدها.'],
  work: ['الشغل مش بينسى يا نجم.', 'خليها تخلص قبل ما هي تخلصك.'],
  health: ['جسمك له حق عليك.', 'خد بالك من نفسك بقى.'],
  meeting: ['ما تتأخرش وتقول الزحمة.', 'ادخل مجهز مش داخل جاري.'],
  shopping: ['المرة دي ما تنساش الحاجة الأساسية.', 'هات المطلوب وارجع من غير لف كتير.'],
};

const repliesByMode: Record<GhostMode, (input: ReplyInput) => string[]> = {
  sassy: ({ title, category }) => [
    `تمام... ${title} اتحجزت، ومفيش حجة بعد كده.`,
    `${title} اتسجلت. ${categoryRoasts[category]?.[0] ?? 'هعديهالك المرة دي.'}`,
    `اتحفظت. الجوست هيفكرك بدل ما دماغك تعمل logout.`,
  ],
  coach: ({ title }) => [
    `${title} اتحفظت. يلا نلعبها صح.`,
    `تمام يا بطل. ${title} بقت تحت السيطرة.`,
    `ثبتناها. ركز في التنفيذ والباقي عليا.`,
  ],
  mom: ({ title }) => [
    `${title} اتحفظت. ماتنساش بقى يا حبيبي.`,
    `تمام، ${title}. خليك فاكر ومتتأخرش.`,
    `سجلتها لك. وركز على نفسك شوية.`,
  ],
  calm: ({ title }) => [
    `${title} جاهزة. هفكرك في وقتها.`,
    `تمام، اتحفظت بهدوء.`,
    `${title} اتسجلت. سيب الباقي عليا.`,
  ],
};

const categoryRoastsEnglish: Partial<Record<ReminderCategory, string[]>> = {
  study: ['Your book is still waiting.', 'Studying will not finish itself.'],
  work: ['Work does not forget.', 'Finish it before it finishes you.'],
  health: ['Your body has rights too.', 'Take care of yourself.'],
  meeting: ['Do not blame traffic this time.', 'Show up prepared.'],
  shopping: ['Do not forget the essentials this time.', 'Get what you need and leave.'],
};

const repliesByModeEnglish: Record<GhostMode, (input: ReplyInput) => string[]> = {
  sassy: ({ title, category }) => [
    `Alright... ${title} is locked in. No excuses now.`,
    `${title} is saved. ${categoryRoastsEnglish[category]?.[0] ?? 'I will let this one slide.'}`,
    `Saved. Fakarni will remember it so your brain does not have to.`,
  ],
  coach: ({ title }) => [
    `${title} is saved. Let's do it right.`,
    `Nice. ${title} is under control now.`,
    `Locked in. Focus on execution and I will handle the reminder.`,
  ],
  mom: ({ title }) => [
    `${title} is saved. Please do not forget it.`,
    `Okay, ${title}. Just do not be late.`,
    `Saved for you. Take care of yourself too.`,
  ],
  calm: ({ title }) => [
    `${title} is ready. I will remind you on time.`,
    `Saved quietly.`,
    `${title} is recorded. I will handle the rest.`,
  ],
};

function hashValue(value: string) {
  return value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
}

const modeLabelsEnglish: Record<GhostMode, string> = {
  sassy: 'Sassy',
  coach: 'Coach',
  mom: 'Mom',
  calm: 'Calm',
};

export function getGhostModeLabel(mode: GhostMode, language: UiLanguage = 'ar-EG') {
  return language === 'en' ? modeLabelsEnglish[mode] : modeLabels[mode];
}

export function buildGhostReply(input: ReplyInput) {
  const options =
    input.language === 'en' ? repliesByModeEnglish[input.mode](input) : repliesByMode[input.mode](input);
  const index = hashValue(`${input.title}-${input.category}-${input.recurrence}`) % options.length;
  return options[index];
}

export function buildShareMessage(
  reminder: Reminder,
  mode: GhostMode,
  language: UiLanguage = 'ar-EG'
) {
  const category = getReminderCategoryLabel(reminder.category, language);
  const reply = buildGhostReply({
    mode,
    title: reminder.title,
    category: reminder.category,
    recurrence: reminder.recurrence,
    language,
  });

  if (language === 'en') {
    return [
      'Fakarni 👻',
      '',
      `Reminder: ${reminder.title}`,
      `Category: ${category}`,
      `Time: ${toArabicDateTimeLabel(reminder.eventAt, language)}`,
      `Offset: ${relativeReminderLabel(reminder.offsetMinutes, language)}`,
      '',
      reply,
    ].join('\n');
  }

  return [
    'Fakarni 👻',
    '',
    `التذكير: ${reminder.title}`,
    `الفئة: ${category}`,
    `الموعد: ${toArabicDateTimeLabel(reminder.eventAt, language)}`,
    `التنبيه: ${relativeReminderLabel(reminder.offsetMinutes, language)}`,
    '',
    reply,
  ].join('\n');
}
