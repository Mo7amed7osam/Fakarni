import dayjs from 'dayjs';
import {
  ParseResult,
  Recurrence,
} from '../types';
import { normalizeArabicText } from './arabic';
import { classifyReminderCategory } from './categorization';
import { refineParseWithLLM } from '../services/llm';

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

function extractRecurrence(value: string): Recurrence {
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

function parseOffsetMinutes(value: string) {
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

function parseDayBase(value: string) {
  const now = dayjs();

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

function parseTimeParts(value: string) {
  const patterns = [
    /الساعه\s*(\d{1,2})(?::|\.|٫)?(\d{2})?\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)?/,
    /(\d{1,2})(?::|\.|٫)?(\d{2})?\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)/,
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

function stripMetaFromTitle(value: string) {
  return value
    .replace(/فكرني|ذكرني|افتكرني|عايزك تفكرني|من فضلك/g, '')
    .replace(/بعد بكره|بكره|غدا|النهارده|اليوم|دلوقتي/g, '')
    .replace(/الساعه\s*\d{1,2}(?::|\.|٫)?\d{0,2}\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)?/g, '')
    .replace(/\d{1,2}(?::|\.|٫)?\d{0,2}\s*(الصبح|صباحا|العصر|المغرب|المساء|مساء|بالليل|ليل)/g, '')
    .replace(/(?:قبل|ب)\s*(نص ساعه|نصف ساعه|ربع ساعه|ساعه|ساعتين|\d{1,3}\s*دقيقه|\d{1,2}\s*ساع(?:ه|ات))/g, '')
    .replace(
      /ايام العمل|أيام العمل|كل يوم شغل|كل يوم من الاحد للخميس|كل يوم من الاثنين للجمعه|كل يوم من الاثنين للجمعة|كل يوم من الاتنين للجمعه|كل يوم من الاتنين للجمعة|كل يوم|يومي|يوميا|كل اسبوع|اسبوعيا/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseReminderRules(transcript: string): ParseResult {
  const normalized = normalizeArabicText(transcript);
  const recurrenceSuggestion = extractRecurrence(normalized);
  const offsetMinutes = parseOffsetMinutes(normalized);
  const dayBase = parseDayBase(normalized);
  const timeParts = parseTimeParts(normalized);
  const missingFields: string[] = [];
  let confidence = 0.45;

  let eventDate = dayBase;
  if (!eventDate) {
    eventDate = dayjs().startOf('day');
    missingFields.push('date');
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

  const title = stripMetaFromTitle(normalized);
  const categorySuggestion = classifyReminderCategory(title || normalized);

  if (!title) {
    missingFields.push('title');
  } else {
    confidence += 0.2;
  }

  const remindAt = eventAt.subtract(offsetMinutes, 'minute');

  return {
    title: title || 'تذكير جديد',
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
