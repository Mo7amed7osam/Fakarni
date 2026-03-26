import dayjs from 'dayjs';
import {
  ParseResult,
  Recurrence,
  ReminderCategory,
} from '../types';

const validCategories: ReminderCategory[] = [
  'study',
  'work',
  'meeting',
  'health',
  'shopping',
  'finance',
  'personal',
  'other',
];

const validRecurrence: Recurrence[] = ['none', 'daily', 'weekly', 'weekdays'];

interface LLMParsePayload {
  title?: unknown;
  category?: unknown;
  eventAt?: unknown;
  offsetMinutes?: unknown;
  recurrence?: unknown;
  confidence?: unknown;
  missingFields?: unknown;
}

function detectPromptLocale(transcript: string) {
  const englishMatches = transcript.match(/[A-Za-z]/g)?.length ?? 0;
  const arabicMatches = transcript.match(/[ء-ي]/g)?.length ?? 0;
  return englishMatches > arabicMatches ? 'en-US' : 'ar-EG';
}

export function isLLMConfigured() {
  return Boolean(
    process.env.EXPO_PUBLIC_LLM_API_KEY &&
      process.env.EXPO_PUBLIC_LLM_BASE_URL &&
      process.env.EXPO_PUBLIC_LLM_MODEL
  );
}

function extractJSONString(content: unknown) {
  if (typeof content !== 'string') {
    return null;
  }

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return content.slice(firstBrace, lastBrace + 1);
}

function normalizeCategory(value: unknown, fallback: ReminderCategory) {
  return typeof value === 'string' && validCategories.includes(value as ReminderCategory)
    ? (value as ReminderCategory)
    : fallback;
}

function normalizeRecurrence(value: unknown, fallback: Recurrence) {
  return typeof value === 'string' && validRecurrence.includes(value as Recurrence)
    ? (value as Recurrence)
    : fallback;
}

function normalizeMissingFields(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeEventAt(value: unknown, fallback: string | null) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return fallback;
  }

  return parsed.toISOString();
}

export async function refineParseWithLLM(
  transcript: string,
  baseParse: ParseResult
) {
  if (!isLLMConfigured()) {
    return null;
  }

  const baseUrl = process.env.EXPO_PUBLIC_LLM_BASE_URL!;
  const apiKey = process.env.EXPO_PUBLIC_LLM_API_KEY!;
  const model = process.env.EXPO_PUBLIC_LLM_MODEL!;
  const locale = detectPromptLocale(transcript);

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'You parse reminder requests spoken in either Egyptian Arabic or English into reminder data. Return JSON only with keys: title, category, eventAt, offsetMinutes, recurrence, confidence, missingFields. category must be one of study|work|meeting|health|shopping|finance|personal|other. recurrence must be none|daily|weekly|weekdays. Use weekdays only for phrases such as weekdays, every work day, every working day, or from Monday to Friday. eventAt must be full ISO 8601 with a concrete date and time. Use the provided now, locale, and timezone as ground truth for phrases like today, tomorrow, next Thursday, after tomorrow, at 5 pm, one hour before, in 2 minutes, after 10 minutes, كمان دقيقتين, or بعد 5 دقايق. Relative future phrases such as in 2 minutes, after 10 minutes, كمان دقيقتين, and بعد 5 دقايق refer to the event time itself, so offsetMinutes should stay 0 unless the user explicitly asks for a before-reminder with phrases like before or قبل. Egyptian Arabic shorthand imperative phrases are valid reminder requests even when the user does not say formal lead-ins like فكرني or عايزك تفكرني. Treat clipped commands such as كلم, ابعت, روح, هات, ادفع, احجز, اشتر, افتح, راجع, and ذاكر as intended reminder tasks, not parser noise. Normalize the title into a clear task form when needed while preserving the user language and meaning, for example كلم احمد should become a clearer task title like اكلم احمد. Do not invent recurrence unless the user explicitly asks for repetition. If any field is ambiguous, keep the safest best guess, reduce confidence, and include that field in missingFields. Preserve the user language in the title when possible.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            locale,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            now: new Date().toISOString(),
            nowLocal: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            transcript,
            currentRuleParse: baseParse,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }

  const json = await response.json();
  const rawContent = json?.choices?.[0]?.message?.content;
  const content =
    typeof rawContent === 'string'
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.map((item) => item?.text ?? '').join('\n')
        : '';
  const jsonText = extractJSONString(content);
  if (!jsonText) {
    return null;
  }

  const parsed = JSON.parse(jsonText) as LLMParsePayload;
  const eventAt = normalizeEventAt(parsed.eventAt, baseParse.eventAt);
  const offsetMinutes =
    typeof parsed.offsetMinutes === 'number' && parsed.offsetMinutes >= 0
      ? parsed.offsetMinutes
      : baseParse.offsetMinutes;

  return {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : baseParse.title,
    eventAt,
    remindAt: eventAt
      ? dayjs(eventAt).subtract(offsetMinutes, 'minute').toISOString()
      : baseParse.remindAt,
    categorySuggestion: normalizeCategory(parsed.category, baseParse.categorySuggestion),
    offsetMinutes,
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(baseParse.confidence, Math.min(parsed.confidence, 0.99))
        : Math.min(baseParse.confidence + 0.08, 0.96),
    needsConfirmation: false,
    missingFields: normalizeMissingFields(parsed.missingFields, baseParse.missingFields),
    recurrenceSuggestion: normalizeRecurrence(
      parsed.recurrence,
      baseParse.recurrenceSuggestion ?? 'none'
    ),
    source: 'llm',
  } satisfies ParseResult;
}
