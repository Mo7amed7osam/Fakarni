import { GhostMode, Reminder, ReminderCategory, ReminderDraft } from '../types';
import { getReminderCategoryLabel } from './categorization';
import { relativeReminderLabel, toArabicDateTimeLabel } from './arabic';

type ReplyInput = {
  mode: GhostMode;
  title: string;
  category: ReminderCategory;
  recurrence: Reminder['recurrence'] | ReminderDraft['recurrence'];
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

function hashValue(value: string) {
  return value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
}

export function getGhostModeLabel(mode: GhostMode) {
  return modeLabels[mode];
}

export function buildGhostReply(input: ReplyInput) {
  const options = repliesByMode[input.mode](input);
  const index = hashValue(`${input.title}-${input.category}-${input.recurrence}`) % options.length;
  return options[index];
}

export function buildShareMessage(reminder: Reminder, mode: GhostMode) {
  const category = getReminderCategoryLabel(reminder.category);
  const reply = buildGhostReply({
    mode,
    title: reminder.title,
    category: reminder.category,
    recurrence: reminder.recurrence,
  });

  return [
    'VoiceGhost 👻',
    '',
    `التذكير: ${reminder.title}`,
    `الفئة: ${category}`,
    `الموعد: ${toArabicDateTimeLabel(reminder.eventAt)}`,
    `التنبيه: ${relativeReminderLabel(reminder.offsetMinutes)}`,
    '',
    reply,
  ].join('\n');
}
