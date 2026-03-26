import dayjs from 'dayjs';
import {
  ParseLLMReason,
  ParseResult,
  Recurrence,
} from '../types';
import { normalizeArabicText } from './arabic';
import { classifyReminderCategory } from './categorization';
import { isLLMConfigured, refineParseWithLLM } from '../services/llm';

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

function parseRelativeFutureMinutes(value: string, language: RuleLanguage) {
  if (language === 'en') {
    const directPatterns: Array<[RegExp, number]> = [
      [/\b(?:in|after)\s+an\s+hour\b/, 60],
      [/\b(?:in|after)\s+two\s+hours\b/, 120],
      [/\b(?:in|after)\s+1\s+hour\b/, 60],
      [/\b(?:in|after)\s+2\s+hours\b/, 120],
      [/\b(?:in|after)\s+1\s+minute\b/, 1],
      [/\b(?:in|after)\s+2\s+minutes\b/, 2],
    ];

    for (const [pattern, amount] of directPatterns) {
      if (pattern.test(value)) {
        return amount;
      }
    }

    const minuteMatch = value.match(/\b(?:in|after)\s+(\d{1,3})\s+minutes?\b/);
    if (minuteMatch) {
      return Number(minuteMatch[1]);
    }

    const hourMatch = value.match(/\b(?:in|after)\s+(\d{1,2})\s+hours?\b/);
    if (hourMatch) {
      return Number(hourMatch[1]) * 60;
    }

    return null;
  }

  const directPatterns: Array<[RegExp, number]> = [
    [/(?:بعد|كمان)\s*دقيقه(?=\s|$)/, 1],
    [/(?:بعد|كمان)\s*دقيقتين(?=\s|$)/, 2],
    [/(?:بعد|كمان)\s*ساعه(?=\s|$)/, 60],
    [/(?:بعد|كمان)\s*ساعتين(?=\s|$)/, 120],
  ];

  for (const [pattern, amount] of directPatterns) {
    if (pattern.test(value)) {
      return amount;
    }
  }

  const minuteMatch = value.match(
    /(?:بعد|كمان)\s*(\d{1,3})\s*(?:دقيقه|دقايق|دقائق)(?=\s|$)/
  );
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  const hourMatch = value.match(/(?:بعد|كمان)\s*(\d{1,2})\s*(?:ساعه|ساعات)(?=\s|$)/);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  return null;
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
      .replace(/\b(?:in|after)\s+(?:an\s+hour|two\s+hours|1\s+hour|2\s+hours|1\s+minute|2\s+minutes|\d{1,3}\s+minutes?|\d{1,2}\s+hours?)\b/g, '')
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
    .replace(/(?:بعد|كمان)\s*(?:دقيقه|دقيقتين|ساعه|ساعتين|\d{1,3}\s*(?:دقيقه|دقايق|دقائق)|\d{1,2}\s*(?:ساعه|ساعات))/g, '')
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

function ceilToMinute(value: dayjs.Dayjs) {
  if (value.second() === 0 && value.millisecond() === 0) {
    return value;
  }

  return value.add(1, 'minute').startOf('minute');
}

export function parseReminderRules(transcript: string): ParseResult {
  const normalized = normalizeTranscriptForRules(transcript);
  const language = detectRuleLanguage(transcript);
  const recurrenceSuggestion = extractRecurrence(normalized, language);
  const offsetMinutes = parseOffsetMinutes(normalized, language);
  const relativeFutureMinutes = parseRelativeFutureMinutes(normalized, language);
  const dayBase = parseDayBase(normalized, language);
  const timeParts = parseTimeParts(normalized, language);
  const missingFields: string[] = [];
  let confidence = 0.45;

  let eventAt: dayjs.Dayjs;

  if (relativeFutureMinutes !== null) {
    eventAt = ceilToMinute(dayjs().add(relativeFutureMinutes, 'minute'));
    confidence += 0.4;
  } else {
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

    eventAt = eventDate.hour(hour).minute(minute).second(0).millisecond(0);

    if (!dayBase && timeParts) {
      const now = dayjs();
      if (eventAt.isBefore(now)) {
        eventAt = eventAt.add(1, 'day');
      }
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
  if (remindAt.isBefore(dayjs().add(1, 'minute'))) {
    confidence = Math.min(confidence, 0.72);
  }

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
    llmUsed: false,
    cacheHit: false,
    modelTier: 'none',
    parsePath: missingFields.length > 0 || confidence < 0.88 ? 'review_required' : 'rules_only',
  };
}

function hasMixedLanguageTranscript(transcript: string) {
  return /[A-Za-z]/.test(transcript) && /[ء-ي]/.test(transcript);
}

function hasRelativeTimeAmbiguity(normalized: string) {
  return /(?:\b(?:in|after)\b|(?:بعد|كمان))/.test(normalized);
}

function hasRecurrenceHintWithoutParse(normalized: string, recurrenceSuggestion: Recurrence) {
  if (recurrenceSuggestion !== 'none') {
    return false;
  }

  return /(?:\bevery\b|\bdaily\b|\bweekly\b|\bweekdays\b|(?:^|\s)كل(?:\s|$)|(?:^|\s)يومي(?:\s|$)|(?:^|\s)يوميا(?:\s|$)|(?:^|\s)اسبوعيا(?:\s|$)|(?:^|\s)اسبوعي(?:\s|$)|كل يوم|كل اسبوع|ايام العمل|أيام العمل)/.test(
    normalized
  );
}

function getLLMReason(transcript: string, ruleParse: ParseResult): ParseLLMReason | null {
  const normalized = normalizeTranscriptForRules(transcript);

  if (!ruleParse.title.trim() || ruleParse.title === 'تذكير جديد' || ruleParse.title === 'New reminder') {
    return 'weak_title';
  }

  if (ruleParse.missingFields.length > 0) {
    return 'missing_fields';
  }

  if (hasMixedLanguageTranscript(transcript)) {
    return 'mixed_language';
  }

  if (hasRecurrenceHintWithoutParse(normalized, ruleParse.recurrenceSuggestion ?? 'none')) {
    return 'recurrence_ambiguous';
  }

  if (hasRelativeTimeAmbiguity(normalized) && ruleParse.confidence < 0.9) {
    return 'relative_time_ambiguous';
  }

  if (ruleParse.confidence < 0.88) {
    return 'low_confidence';
  }

  return null;
}

export async function parseReminderText(transcript: string): Promise<ParseResult> {
  const ruleParse = parseReminderRules(transcript);
  const llmReason = getLLMReason(transcript, ruleParse);

  if (!llmReason) {
    return {
      ...ruleParse,
      llmUsed: false,
      llmReason: undefined,
      cacheHit: false,
      modelTier: 'none',
      parsePath: 'rules_only',
    };
  }

  if (!isLLMConfigured()) {
    return {
      ...ruleParse,
      llmUsed: false,
      llmReason,
      cacheHit: false,
      modelTier: 'none',
      parsePath: 'review_required',
    };
  }

  try {
    const llmParse = await refineParseWithLLM(transcript, ruleParse, llmReason);
    if (!llmParse) {
      return {
        ...ruleParse,
        llmUsed: false,
        llmReason,
        cacheHit: false,
        modelTier: 'none',
        parsePath: 'review_required',
      };
    }

    return {
      ...llmParse,
      needsConfirmation:
        llmParse.missingFields.length > 0 || llmParse.confidence < 0.88,
      source: 'hybrid',
      llmUsed: true,
      llmReason,
      cacheHit: Boolean(llmParse.cacheHit),
      modelTier: llmParse.modelTier ?? 'mini',
      parsePath:
        llmParse.parsePath ??
        (llmParse.missingFields.length > 0 || llmParse.confidence < 0.88
          ? 'review_required'
          : 'mini_model'),
    };
  } catch {
    return {
      ...ruleParse,
      llmUsed: false,
      llmReason,
      cacheHit: false,
      modelTier: 'none',
      parsePath: 'review_required',
    };
  }
}
