import dayjs from 'dayjs';
import {
  ParseResult,
  Recurrence,
} from '../types';
import { normalizeArabicText } from './arabic';
import { classifyReminderCategory } from './categorization';
import { refineParseWithLLM } from '../services/llm';

type RuleLanguage = 'ar' | 'en';

const weekdayMap: Record<string, number> = {
  الاحد: 0,
  الاحدين: 0,
  الاحدي: 0,
  الاتنين: 1,
  الاثنين: 1,
  الثلاثاء: 2,
  الاربعاء: 3,
  الأربعاء: 3,
  الخميس: 4,
  الجمعه: 5,
  الجمعة: 5,
  السبت: 6,
};

const englishWeekdayMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const arabicTaskTitleNormalizers: Array<[RegExp, string]> = [
  [/^كلم(?=\s|$)/, 'اكلم'],
  [/^روح(?=\s|$)/, 'اروح'],
  [/^راجع(?=\s|$)/, 'اراجع'],
  [/^ذاكر(?=\s|$)/, 'اذاكر'],
];

function detectRuleLanguage(value: string): RuleLanguage {
  const englishMatches = value.match(/[A-Za-z]/g)?.length ?? 0;
  const arabicMatches = value.match(/[ء-ي]/g)?.length ?? 0;
  return englishMatches > arabicMatches ? 'en' : 'ar';
}

function normalizeTranscriptForRules(value: string) {
  return normalizeArabicText(value).toLowerCase();
}

function extractRecurrence(value: string, language: RuleLanguage): Recurrence {
  if (language === 'en') {
    if (/weekdays|every workday|every working day|monday to friday/.test(value)) {
      return 'weekdays';
    }

    if (/every day|daily/.test(value)) {
      return 'daily';
    }

    if (
      /every week|weekly|every sunday|every monday|every tuesday|every wednesday|every thursday|every friday|every saturday/.test(
        value
      )
    ) {
      return 'weekly';
    }

    return 'none';
  }

  if (
    /ايام العمل|أيام العمل|كل يوم شغل|كل يوم من الاحد للخميس|كل يوم من الاثنين للجمعه|كل يوم من الاثنين للجمعة|كل يوم من الاتنين للجمعه|كل يوم من الاتنين للجمعة|كل يوم من الاثنين الى الجمعه|كل يوم من الاثنين الى الجمعة|كل يوم من الاتنين الى الجمعه|كل يوم من الاتنين الى الجمعة/.test(
      value
    )
  ) {
    return 'weekdays';
  }

  if (/كل يوم|يومي|يوميا/.test(value)) {
    return 'daily';
  }

  if (/كل اسبوع|اسبوعيا|كل جمعه|كل سبت|كل احد|كل اتنين|كل ثلاثاء|كل اربعاء|كل خميس/.test(value)) {
    return 'weekly';
  }

  return 'none';
}

function parseOffsetMinutes(value: string, language: RuleLanguage) {
  if (language === 'en') {
    const directPatterns: Array<[RegExp, number]> = [
      [/(?:half an hour|30 minutes)\s+before/, 30],
      [/(?:quarter of an hour|15 minutes)\s+before/, 15],
      [/(?:an hour|1 hour)\s+before/, 60],
      [/(?:2 hours|two hours)\s+before/, 120],
    ];

    for (const [pattern, amount] of directPatterns) {
      if (pattern.test(value)) {
        return amount;
      }
    }

    const minuteMatch = value.match(/(\d{1,3})\s*minutes?\s+before/);
    if (minuteMatch) {
      return Number(minuteMatch[1]);
    }

    const hourMatch = value.match(/(\d{1,2})\s*hours?\s+before/);
    if (hourMatch) {
      return Number(hourMatch[1]) * 60;
    }

    return 0;
  }

  const directPatterns: Array<[RegExp, number]> = [
    [/(?:قبل|ب)\s*نص ساعه/, 30],
    [/(?:قبل|ب)\s*نصف ساعه/, 30],
    [/(?:قبل|ب)\s*ربع ساعه/, 15],
    [/(?:قبل|ب)\s*ساعه/, 60],
    [/(?:قبل|ب)\s*ساعتين/, 120],
  ];

  for (const [pattern, amount] of directPatterns) {
    if (pattern.test(value)) {
      return amount;
    }
  }

  const minuteMatch = value.match(/(?:قبل|ب)\s*(\d{1,3})\s*دقيقه/);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  const hourMatch = value.match(/(?:قبل|ب)\s*(\d{1,2})\s*ساع(?:ه|ات)/);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  return 0;
}

function parseDayBase(value: string, language: RuleLanguage) {
  const now = dayjs();

  if (language === 'en') {
    if (/day after tomorrow/.test(value)) {
      return now.add(2, 'day').startOf('day');
    }

    if (/tomorrow/.test(value)) {
      return now.add(1, 'day').startOf('day');
    }

    if (/today|now|tonight/.test(value)) {
      return now.startOf('day');
    }

    const weekdayMatch = Object.keys(englishWeekdayMap).find((day) => value.includes(day));
    if (weekdayMatch) {
      const targetWeekday = englishWeekdayMap[weekdayMatch];
      let candidate = now.day(targetWeekday).startOf('day');
      if (
        value.includes(`next ${weekdayMatch}`) ||
        candidate.isBefore(now, 'day') ||
        candidate.isSame(now, 'day')
      ) {
        candidate = candidate.add(7, 'day');
      }
      return candidate;
    }

    return null;
  }

  if (/بعد بكره/.test(value)) {
    return now.add(2, 'day').startOf('day');
  }

  if (/بكره|غدا/.test(value)) {
    return now.add(1, 'day').startOf('day');
  }

  if (/النهارده|اليوم|دلوقتي/.test(value)) {
    return now.startOf('day');
  }

  const weekdayMatch = Object.keys(weekdayMap).find((day) => value.includes(day));
  if (weekdayMatch) {
    const targetWeekday = weekdayMap[weekdayMatch];
    let candidate = now.day(targetWeekday).startOf('day');
    if (candidate.isBefore(now, 'day') || candidate.isSame(now, 'day')) {
      candidate = candidate.add(7, 'day');
    }
    return candidate;
  }

  return null;
}

function parseTimeParts(value: string, language: RuleLanguage) {
  if (language === 'en') {
    if (/\bnoon\b/.test(value)) {
      return { hour: 12, minute: 0, inferred: false };
    }

    if (/\bmidnight\b/.test(value)) {
      return { hour: 0, minute: 0, inferred: false };
    }

    const patterns = [
      /at\s*(\d{1,2})(?::|\.|٫)?(\d{2})?\s*(am|pm)?/,
      /(\d{1,2})(?::|\.|٫)?(\d{2})?\s*(am|pm)\b/,
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (!match) {
        continue;
      }

      let hour = Number(match[1]);
      const minute = Number(match[2] ?? '0');
      const meridiem = match[3] ?? '';

      if (meridiem === 'pm' && hour < 12) {
        hour += 12;
      }

      if (meridiem === 'am' && hour === 12) {
        hour = 0;
      }

      return { hour, minute, inferred: !meridiem };
    }

    if (/\bmorning\b/.test(value)) {
      return { hour: 9, minute: 0, inferred: true };
    }

    if (/\bafternoon\b/.test(value)) {
      return { hour: 15, minute: 0, inferred: true };
    }

    if (/\bevening\b|\btonight\b/.test(value)) {
      return { hour: 20, minute: 0, inferred: true };
    }

    return null;
  }

  const patterns = [
    /الساعه\s*(\d{1,2})(?::|\.|٫)?(\d{2})?\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)?/,
    /(\d{1,2})(?::|\.|٫)?(\d{2})?\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)/,
    /\b([1-9]|1[0-2])(?::|\.|٫)?(\d{2})?\b(?!\s*(?:دقيقه|دقائق|ساعه|ساعتين|ساعات))/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) {
      continue;
    }

    let hour = Number(match[1]);
    const minute = Number(match[2] ?? '0');
    const partOfDay = match[3] ?? '';

    if (/العصر|المغرب|المساء|مساء|بالليل|ليل/.test(partOfDay) && hour < 12) {
      hour += 12;
    }

    if (/الصبح|صباحا/.test(partOfDay) && hour === 12) {
      hour = 0;
    }

    const inferred = !partOfDay;

    return { hour, minute, inferred };
  }

  return null;
}

function stripMetaFromTitle(value: string, language: RuleLanguage) {
  if (language === 'en') {
    return value
      .replace(
        /remind me to|remind me|remember to|don't let me forget to|dont let me forget to|please remind me to|please remind me/g,
        ''
      )
      .replace(/day after tomorrow|tomorrow|today|now|tonight/g, '')
      .replace(
        /next sunday|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|sunday|monday|tuesday|wednesday|thursday|friday|saturday/g,
        ''
      )
      .replace(/at\s*\d{1,2}(?::|\.|٫)?\d{0,2}\s*(am|pm)?/g, '')
      .replace(/\d{1,2}(?::|\.|٫)?\d{0,2}\s*(am|pm)\b/g, '')
      .replace(
        /(?:half an hour|30 minutes|quarter of an hour|15 minutes|an hour|1 hour|2 hours|two hours|\d{1,3}\s*minutes?|\d{1,2}\s*hours?)\s+before/g,
        ''
      )
      .replace(
        /weekdays|every workday|every working day|monday to friday|every day|daily|every week|weekly|every sunday|every monday|every tuesday|every wednesday|every thursday|every friday|every saturday/g,
        ''
      )
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return value
    .replace(/فكرني|ذكرني|افتكرني|عايزك تفكرني|من فضلك/g, '')
    .replace(/بعد بكره|بكره|غدا|النهارده|اليوم|دلوقتي/g, '')
    .replace(/الاحد|الأحد|الاتنين|الاثنين|الثلاثاء|الاربعاء|الأربعاء|الخميس|الجمعه|الجمعة|السبت/g, '')
    .replace(/الساعه\s*\d{1,2}(?::|\.|٫)?\d{0,2}\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)?/g, '')
    .replace(/\d{1,2}(?::|\.|٫)?\d{0,2}\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)/g, '')
    .replace(/(?:قبل|ب)\s*(نص ساعه|نصف ساعه|ربع ساعه|ساعه|ساعتين|\d{1,3}\s*دقيقه|\d{1,2}\s*ساع(?:ه|ات))/g, '')
    .replace(
      /ايام العمل|أيام العمل|كل يوم شغل|كل يوم من الاحد للخميس|كل يوم من الاثنين للجمعه|كل يوم من الاثنين للجمعة|كل يوم من الاتنين للجمعه|كل يوم من الاتنين للجمعة|كل يوم|يومي|يوميا|كل اسبوع|اسبوعيا/g,
      ''
    )
    .replace(/\b([1-9]|1[0-2])(?::|\.|٫)?(\d{2})?\b(?!\s*(?:دقيقه|دقائق|ساعه|ساعتين|ساعات))/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArabicTaskTitle(value: string) {
  let normalized = value.trim();

  for (const [pattern, replacement] of arabicTaskTitleNormalizers) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement);
      break;
    }
  }

  return normalized
    .replace(/\bايميل\b/g, 'الايميل')
    .replace(/\bايجار\b/g, 'الايجار')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseReminderRules(transcript: string): ParseResult {
  const normalized = normalizeTranscriptForRules(transcript);
  const language = detectRuleLanguage(transcript);
  const recurrenceSuggestion = extractRecurrence(normalized, language);
  const offsetMinutes = parseOffsetMinutes(normalized, language);
  const dayBase = parseDayBase(normalized, language);
  const timeParts = parseTimeParts(normalized, language);
  const missingFields: string[] = [];
  let confidence = 0.45;

  let eventDate = dayBase;
  if (!eventDate) {
    eventDate = dayjs().startOf('day');
    if (recurrenceSuggestion !== 'daily' && recurrenceSuggestion !== 'weekdays') {
      missingFields.push('date');
    } else {
      confidence += 0.1;
    }
  } else {
    confidence += 0.2;
  }

  let hour = 9;
  let minute = 0;
  if (timeParts) {
    hour = timeParts.hour;
    minute = timeParts.minute;
    confidence += timeParts.inferred ? 0.15 : 0.25;
  } else {
    missingFields.push('time');
  }

  let eventAt = eventDate.hour(hour).minute(minute).second(0).millisecond(0);

  if (!dayBase && timeParts) {
    const now = dayjs();
    if (eventAt.isBefore(now)) {
      eventAt = eventAt.add(1, 'day');
    }
  }

  const rawTitle = stripMetaFromTitle(normalized, language);
  const title =
    language === 'ar' ? normalizeArabicTaskTitle(rawTitle) : rawTitle;
  const categorySuggestion = classifyReminderCategory(title || normalized);

  if (!title) {
    missingFields.push('title');
  } else {
    confidence += 0.2;
  }

  const remindAt = eventAt.subtract(offsetMinutes, 'minute');

  return {
    title: title || (language === 'en' ? 'New reminder' : 'تذكير جديد'),
    eventAt: eventAt.toISOString(),
    remindAt: remindAt.toISOString(),
    categorySuggestion,
    offsetMinutes,
    confidence: Math.min(confidence, 0.98),
    needsConfirmation: missingFields.length > 0 || confidence < 0.8,
    missingFields,
    recurrenceSuggestion,
    source: 'rules',
  };
}

export async function parseReminderText(transcript: string): Promise<ParseResult> {
  const ruleParse = parseReminderRules(transcript);

  try {
    const llmParse = await refineParseWithLLM(transcript, ruleParse);
    if (!llmParse) {
      return ruleParse;
    }

    return {
      ...llmParse,
      needsConfirmation:
        llmParse.missingFields.length > 0 || llmParse.confidence < 0.88,
      source: 'hybrid',
    };
  } catch {
    return ruleParse;
  }
}
