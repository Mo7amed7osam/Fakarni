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

function getMiniModel() {
  return process.env.EXPO_PUBLIC_LLM_MINI_MODEL ?? process.env.EXPO_PUBLIC_LLM_MODEL ?? '';
}

function getStrongModel() {
  return process.env.EXPO_PUBLIC_LLM_STRONG_MODEL ?? process.env.EXPO_PUBLIC_LLM_MODEL ?? '';
}

export function isLLMConfigured() {
  return Boolean(
    parseGatewayUrl ||
      (process.env.EXPO_PUBLIC_LLM_API_KEY &&
        process.env.EXPO_PUBLIC_LLM_BASE_URL &&
        getMiniModel())
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
  }: {
    modelTier: ParseModelTier;
    cacheHit: boolean;
    parsePath: ParsePath;
    llmReason?: ParseLLMReason;
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

function needsStrongModel(result: ParseResult, baseParse: ParseResult) {
  if (!result.title.trim() || !result.eventAt) {
    return true;
  }

  if (result.confidence < 0.84) {
    return true;
  }

  if (result.missingFields.length > 0 && baseParse.missingFields.length > 0) {
    return true;
  }

  return false;
}

function buildSystemPrompt(llmReason?: ParseLLMReason) {
  const reasonHint = llmReason ? `Focus area: ${llmReason}. ` : '';
  return `${reasonHint}You parse reminder requests spoken in either Egyptian Arabic or English into reminder data. Return JSON only with keys: title, category, eventAt, offsetMinutes, recurrence, confidence, missingFields. category must be one of study|work|meeting|health|shopping|finance|personal|other. recurrence must be none|daily|weekly|weekdays. Use weekdays only for phrases such as weekdays, every work day, every working day, or from Monday to Friday. eventAt must be full ISO 8601 with a concrete date and time. Use the provided now, locale, and timezone as ground truth for phrases like today, tomorrow, next Thursday, after tomorrow, at 5 pm, one hour before, in 2 minutes, after 10 minutes, كمان دقيقتين, or بعد 5 دقايق. Relative future phrases such as in 2 minutes, after 10 minutes, كمان دقيقتين, and بعد 5 دقايق refer to the event time itself, so offsetMinutes should stay 0 unless the user explicitly asks for a before-reminder with phrases like before or قبل. Egyptian Arabic shorthand imperative phrases are valid reminder requests even when the user does not say formal lead-ins like فكرني or عايزك تفكرني. Treat clipped commands such as كلم, ابعت, روح, هات, ادفع, احجز, اشتر, افتح, راجع, and ذاكر as intended reminder tasks, not parser noise. Normalize the title into a clear task form when needed while preserving the user language and meaning, for example كلم احمد should become a clearer task title like اكلم احمد. Do not invent recurrence unless the user explicitly asks for repetition. If any field is ambiguous, keep the safest best guess, reduce confidence, and include that field in missingFields. Preserve the user language in the title when possible.`;
}

async function requestChatCompletion(
  model: string,
  transcript: string,
  baseParse: ParseResult,
  llmReason?: ParseLLMReason
) {
  const baseUrl = process.env.EXPO_PUBLIC_LLM_BASE_URL!;
  const apiKey = process.env.EXPO_PUBLIC_LLM_API_KEY!;
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
          content: buildSystemPrompt(llmReason),
        },
        {
          role: 'user',
          content: JSON.stringify({
            locale,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            now: new Date().toISOString(),
            nowLocal: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            transcript,
            currentRuleParse: {
              title: baseParse.title,
              eventAt: baseParse.eventAt,
              offsetMinutes: baseParse.offsetMinutes,
              confidence: baseParse.confidence,
              missingFields: baseParse.missingFields,
              recurrenceSuggestion: baseParse.recurrenceSuggestion,
            },
            llmReason,
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

  return JSON.parse(jsonText) as LLMParsePayload;
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

  const miniModel = getMiniModel();
  const strongModel = getStrongModel();

  let normalizedResult: ParseResult | null = null;

  try {
    if (parseGatewayUrl) {
      const gatewayPayload = await requestGatewayParse(transcript, baseParse, llmReason);
      if (gatewayPayload) {
        normalizedResult = buildNormalizedParseResult(gatewayPayload, baseParse, {
          modelTier: normalizeModelTier(gatewayPayload.modelTier, 'mini'),
          cacheHit: Boolean(gatewayPayload.cacheHit),
          parsePath: normalizeParsePath(gatewayPayload.parsePath, 'mini_model'),
          llmReason,
        });
      }
    } else if (miniModel) {
      const miniPayload = await requestChatCompletion(
        miniModel,
        transcript,
        baseParse,
        llmReason
      );

      if (miniPayload) {
        normalizedResult = buildNormalizedParseResult(miniPayload, baseParse, {
          modelTier: 'mini',
          cacheHit: false,
          parsePath: 'mini_model',
          llmReason,
        });
      }

      if (
        normalizedResult &&
        needsStrongModel(normalizedResult, baseParse) &&
        strongModel &&
        strongModel !== miniModel
      ) {
        const strongPayload = await requestChatCompletion(
          strongModel,
          transcript,
          baseParse,
          llmReason
        );

        if (strongPayload) {
          normalizedResult = buildNormalizedParseResult(strongPayload, baseParse, {
            modelTier: 'strong',
            cacheHit: false,
            parsePath: 'strong_model',
            llmReason,
          });
        }
      }
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
