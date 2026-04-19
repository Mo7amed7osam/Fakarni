import dayjs from 'dayjs';
import {
  ParseLLMReason,
  ParseModelTier,
  ParsePath,
  ParseResult,
  Recurrence,
  ReminderCategory,
} from '../types';
import { normalizeArabicText } from '../utils/arabic';
import { normalizeArabicReminderTitle } from '../utils/reminderTitle';

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
  modelTier?: unknown;
  parsePath?: unknown;
  cacheHit?: unknown;
}

interface CachedParseEntry {
  result: ParseResult;
  expiresAt: number;
}

const parseCache = new Map<string, CachedParseEntry>();
const parseGatewayUrl = process.env.EXPO_PUBLIC_PARSE_GATEWAY_URL ?? '';
const parseClientAppVersion = process.env.EXPO_PUBLIC_APP_VERSION ?? 'dev';

function detectPromptLocale(transcript: string) {
  const englishMatches = transcript.match(/[A-Za-z]/g)?.length ?? 0;
  const arabicMatches = transcript.match(/[ء-ي]/g)?.length ?? 0;
  return englishMatches > arabicMatches ? 'en-US' : 'ar-EG';
}

export function isLLMConfigured() {
  return Boolean(parseGatewayUrl);
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

function normalizeModelTier(value: unknown, fallback: ParseModelTier): ParseModelTier {
  return value === 'mini' || value === 'strong' || value === 'none' ? value : fallback;
}

function normalizeParsePath(value: unknown, fallback: ParsePath): ParsePath {
  return value === 'rules_only' ||
    value === 'cache_hit' ||
    value === 'mini_model' ||
    value === 'strong_model' ||
    value === 'review_required'
    ? value
    : fallback;
}

function buildNormalizedParseResult(
  parsed: LLMParsePayload,
  baseParse: ParseResult,
  {
    modelTier,
    cacheHit,
    parsePath,
    llmReason,
    locale,
  }: {
    modelTier: ParseModelTier;
    cacheHit: boolean;
    parsePath: ParsePath;
    llmReason?: ParseLLMReason;
    locale: string;
  }
): ParseResult {
  const eventAt = normalizeEventAt(parsed.eventAt, baseParse.eventAt);
  const offsetMinutes =
    typeof parsed.offsetMinutes === 'number' && parsed.offsetMinutes >= 0
      ? parsed.offsetMinutes
      : baseParse.offsetMinutes;

  return {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? locale.startsWith('ar')
          ? normalizeArabicReminderTitle(parsed.title.trim())
          : parsed.title.trim()
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
    llmUsed: true,
    llmReason,
    cacheHit,
    modelTier,
    parsePath,
  } satisfies ParseResult;
}

function isRelativeTimeTranscript(value: string) {
  return /(?:\b(?:in|after)\s+(?:an\s+hour|two\s+hours|\d{1,3}\s+minutes?|\d{1,2}\s+hours?)\b|(?:بعد|كمان)\s*(?:دقيقه|دقيقتين|ساعه|ساعتين|\d{1,3}\s*(?:دقيقه|دقايق|دقائق)|\d{1,2}\s*(?:ساعه|ساعات)))/.test(
    normalizeArabicText(value).toLowerCase()
  );
}

function buildCacheKey(transcript: string, llmReason?: ParseLLMReason) {
  const locale = detectPromptLocale(transcript);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const normalizedTranscript = normalizeArabicText(transcript).toLowerCase();
  const relativeBucket = isRelativeTimeTranscript(transcript)
    ? dayjs().startOf('minute').format('YYYY-MM-DDTHH:mm')
    : 'stable';

  return [locale, timezone, llmReason ?? 'none', relativeBucket, normalizedTranscript].join('::');
}

function getCacheTTL(transcript: string) {
  return isRelativeTimeTranscript(transcript) ? 60_000 : 10 * 60_000;
}

function readParseCache(cacheKey: string) {
  const cached = parseCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    parseCache.delete(cacheKey);
    return null;
  }

  return cached.result;
}

function writeParseCache(cacheKey: string, transcript: string, result: ParseResult) {
  parseCache.set(cacheKey, {
    result,
    expiresAt: Date.now() + getCacheTTL(transcript),
  });
}

async function requestGatewayParse(
  transcript: string,
  baseParse: ParseResult,
  llmReason?: ParseLLMReason
) {
  if (!parseGatewayUrl) {
    return null;
  }

  const response = await fetch(parseGatewayUrl.replace(/\/$/, ''), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      originalTranscript: transcript,
      normalizedTranscript: normalizeArabicText(transcript),
      language: detectPromptLocale(transcript),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      appVersion: parseClientAppVersion,
      llmReason,
      currentRuleParse: {
        title: baseParse.title,
        eventAt: baseParse.eventAt,
        offsetMinutes: baseParse.offsetMinutes,
        confidence: baseParse.confidence,
        missingFields: baseParse.missingFields,
        recurrenceSuggestion: baseParse.recurrenceSuggestion,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Parse gateway failed with status ${response.status}`);
  }

  return (await response.json()) as LLMParsePayload;
}

export async function refineParseWithLLM(
  transcript: string,
  baseParse: ParseResult,
  llmReason?: ParseLLMReason
) {
  if (!isLLMConfigured()) {
    return null;
  }

  const locale = detectPromptLocale(transcript);
  const cacheKey = buildCacheKey(transcript, llmReason);
  const cached = readParseCache(cacheKey);
  if (cached) {
    return {
      ...cached,
      llmUsed: Boolean(cached.llmUsed),
      llmReason,
      cacheHit: true,
      parsePath: 'cache_hit',
    } satisfies ParseResult;
  }

  let normalizedResult: ParseResult | null = null;

  try {
    const gatewayPayload = await requestGatewayParse(transcript, baseParse, llmReason);
    if (gatewayPayload) {
      normalizedResult = buildNormalizedParseResult(gatewayPayload, baseParse, {
        modelTier: normalizeModelTier(gatewayPayload.modelTier, 'mini'),
        cacheHit: Boolean(gatewayPayload.cacheHit),
        parsePath: normalizeParsePath(gatewayPayload.parsePath, 'mini_model'),
        llmReason,
        locale,
      });
    }
  } catch {
    return null;
  }

  if (!normalizedResult) {
    return null;
  }

  writeParseCache(cacheKey, transcript, normalizedResult);
  return normalizedResult;
}
