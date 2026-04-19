const http = require('node:http');
const dayjs = require('dayjs');

const validCategories = [
  'study',
  'work',
  'meeting',
  'health',
  'shopping',
  'finance',
  'personal',
  'other',
];

const validRecurrence = ['none', 'daily', 'weekly', 'weekdays'];
const validModelTiers = ['none', 'mini', 'strong'];
const validParsePaths = [
  'rules_only',
  'cache_hit',
  'mini_model',
  'strong_model',
  'review_required',
];

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function normalizeArabicDigits(value) {
  return String(value).replace(/[٠-٩]/g, (digit) => {
    switch (digit) {
      case '٠':
        return '0';
      case '١':
        return '1';
      case '٢':
        return '2';
      case '٣':
        return '3';
      case '٤':
        return '4';
      case '٥':
        return '5';
      case '٦':
        return '6';
      case '٧':
        return '7';
      case '٨':
        return '8';
      case '٩':
        return '9';
      default:
        return digit;
    }
  });
}

function normalizeArabicText(value) {
  return normalizeArabicDigits(value)
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[؟،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJSONString(content) {
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

function detectPromptLocale(transcript, fallbackLanguage) {
  if (typeof fallbackLanguage === 'string' && fallbackLanguage.trim()) {
    return fallbackLanguage;
  }

  const englishMatches = String(transcript).match(/[A-Za-z]/g)?.length ?? 0;
  const arabicMatches = String(transcript).match(/[ء-ي]/g)?.length ?? 0;
  return englishMatches > arabicMatches ? 'en-US' : 'ar-EG';
}

function isRelativeTimeTranscript(value) {
  return /(?:\b(?:in|after)\s+(?:an\s+hour|two\s+hours|\d{1,3}\s+minutes?|\d{1,2}\s+hours?)\b|(?:بعد|كمان)\s*(?:دقيقه|دقيقتين|ساعه|ساعتين|\d{1,3}\s*(?:دقيقه|دقايق|دقائق)|\d{1,2}\s*(?:ساعه|ساعات)))/.test(
    normalizeArabicText(value).toLowerCase()
  );
}

function normalizeEventAt(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return fallback;
  }

  return parsed.toISOString();
}

function normalizeCategory(value, fallback) {
  return typeof value === 'string' && validCategories.includes(value) ? value : fallback;
}

function normalizeRecurrence(value, fallback) {
  return typeof value === 'string' && validRecurrence.includes(value) ? value : fallback;
}

function normalizeMissingFields(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item) => typeof item === 'string');
}

function buildSystemPrompt(llmReason) {
  const reasonHint = llmReason ? `Focus area: ${llmReason}. ` : '';
  return `${reasonHint}You parse reminder requests spoken in either Egyptian Arabic or English into reminder data. Return JSON only with keys: title, category, eventAt, offsetMinutes, recurrence, confidence, missingFields. category must be one of study|work|meeting|health|shopping|finance|personal|other. recurrence must be none|daily|weekly|weekdays. Use weekdays only for phrases such as weekdays, every work day, every working day, or from Monday to Friday. eventAt must be full ISO 8601 with a concrete date and time. Use the provided now, locale, and timezone as ground truth for phrases like today, tomorrow, next Thursday, after tomorrow, at 5 pm, one hour before, in 2 minutes, after 10 minutes, كمان دقيقتين, or بعد 5 دقايق. Relative future phrases such as in 2 minutes, after 10 minutes, كمان دقيقتين, and بعد 5 دقايق refer to the event time itself, so offsetMinutes should stay 0 unless the user explicitly asks for a before-reminder with phrases like before or قبل. Egyptian Arabic shorthand imperative phrases are valid reminder requests even when the user does not say formal lead-ins like فكرني or عايزك تفكرني. Treat clipped commands such as كلم, ابعت, روح, هات, ادفع, احجز, اشتر, افتح, راجع, and ذاكر as intended reminder tasks, not parser noise. Normalize the title into a clear task form when needed while preserving the user language and meaning, for example كلم احمد should become a clearer task title like اكلم احمد. Egyptian Arabic time-of-day conventions matter: 1 الضهر or 1 الظهر means 13:00, 1 بالليل or 1 بليل means 01:00, 5 العصر means 17:00, 6 المغرب is evening around sunset, 8 العشا or 8 العشاء is night, and 7 الصبح or 7 الصباح means 07:00. Treat spelling variants such as الضهر/الظهر, العشا/العشاء, الصبح/الصباح/صباحا, and بالليل/بليل as equivalent. Phrases like بكرة الصبح, بعد بكرة العصر, النهارده بالليل, بعد المغرب, or قبل العصر describe coarse time windows, not exact clock times. For those coarse phrases, use a conservative best guess only if needed, lower confidence, and keep time in missingFields instead of pretending the exact minute was explicit. Do not invent recurrence unless the user explicitly asks for repetition. If any field is ambiguous, keep the safest best guess, reduce confidence, and include that field in missingFields. Preserve the user language in the title when possible.`;
}

function buildCacheKey(payload, nowFactory) {
  const transcript = payload.normalizedTranscript || normalizeArabicText(payload.originalTranscript || '');
  const locale = detectPromptLocale(payload.originalTranscript || transcript, payload.language);
  const timezone = payload.timezone || 'UTC';
  const relativeBucket = isRelativeTimeTranscript(payload.originalTranscript || transcript)
    ? dayjs(nowFactory()).startOf('minute').format('YYYY-MM-DDTHH:mm')
    : 'stable';

  return [
    locale,
    timezone,
    payload.llmReason || 'none',
    relativeBucket,
    normalizeArabicText(transcript).toLowerCase(),
  ].join('::');
}

function getCacheTTL(transcript) {
  return isRelativeTimeTranscript(transcript) ? 60_000 : 10 * 60_000;
}

function readCache(cache, cacheKey, nowFactory) {
  const cached = cache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= nowFactory().getTime()) {
    cache.delete(cacheKey);
    return null;
  }

  return cached.result;
}

function writeCache(cache, cacheKey, transcript, result, nowFactory) {
  cache.set(cacheKey, {
    result,
    expiresAt: nowFactory().getTime() + getCacheTTL(transcript),
  });
}

function buildBaseResponse(baseParse, metadata) {
  return {
    title: typeof baseParse.title === 'string' && baseParse.title.trim() ? baseParse.title.trim() : 'New reminder',
    category: normalizeCategory(baseParse.categorySuggestion, 'other'),
    eventAt: normalizeEventAt(baseParse.eventAt, null),
    offsetMinutes:
      typeof baseParse.offsetMinutes === 'number' && baseParse.offsetMinutes >= 0
        ? baseParse.offsetMinutes
        : 0,
    recurrence: normalizeRecurrence(baseParse.recurrenceSuggestion, 'none'),
    confidence:
      typeof baseParse.confidence === 'number'
        ? Math.max(0, Math.min(baseParse.confidence, 0.99))
        : 0.7,
    missingFields: normalizeMissingFields(baseParse.missingFields, []),
    modelTier: metadata.modelTier,
    parsePath: metadata.parsePath,
    cacheHit: Boolean(metadata.cacheHit),
  };
}

function buildNormalizedResponse(parsed, baseParse, metadata) {
  const eventAt = normalizeEventAt(parsed.eventAt, baseParse.eventAt ?? null);
  const offsetMinutes =
    typeof parsed.offsetMinutes === 'number' && parsed.offsetMinutes >= 0
      ? parsed.offsetMinutes
      : typeof baseParse.offsetMinutes === 'number' && baseParse.offsetMinutes >= 0
        ? baseParse.offsetMinutes
        : 0;

  return {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : typeof baseParse.title === 'string' && baseParse.title.trim()
          ? baseParse.title.trim()
          : 'New reminder',
    category: normalizeCategory(parsed.category, normalizeCategory(baseParse.categorySuggestion, 'other')),
    eventAt,
    offsetMinutes,
    recurrence: normalizeRecurrence(parsed.recurrence, normalizeRecurrence(baseParse.recurrenceSuggestion, 'none')),
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(Math.min(parsed.confidence, 0.99), Math.min(baseParse.confidence ?? 0.7, 0.99))
        : Math.min((baseParse.confidence ?? 0.7) + 0.08, 0.96),
    missingFields: normalizeMissingFields(parsed.missingFields, normalizeMissingFields(baseParse.missingFields, [])),
    modelTier: metadata.modelTier,
    parsePath: metadata.parsePath,
    cacheHit: Boolean(metadata.cacheHit),
  };
}

function needsStrongModel(result, baseParse) {
  if (!result.title.trim() || !result.eventAt) {
    return true;
  }

  if (result.confidence < 0.84) {
    return true;
  }

  if (
    Array.isArray(result.missingFields) &&
    result.missingFields.length > 0 &&
    Array.isArray(baseParse.missingFields) &&
    baseParse.missingFields.length > 0
  ) {
    return true;
  }

  return false;
}

function createGatewayError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function createParseGateway(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;
  const nowFactory = options.nowFactory || (() => new Date());
  const cache = options.cache || new Map();
  const config = {
    baseUrl: options.baseUrl ?? env.PARSE_GATEWAY_BASE_URL ?? '',
    apiKey: options.apiKey ?? env.PARSE_GATEWAY_API_KEY ?? '',
    miniModel:
      options.miniModel ??
      env.PARSE_GATEWAY_MINI_MODEL ??
      env.PARSE_GATEWAY_MODEL ??
      '',
    strongModel:
      options.strongModel ??
      env.PARSE_GATEWAY_STRONG_MODEL ??
      env.PARSE_GATEWAY_MODEL ??
      '',
  };

  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable. Use Node 18+ or provide fetchImpl.');
  }

  async function requestChatCompletion(model, payload) {
    const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(payload.llmReason),
          },
          {
            role: 'user',
            content: JSON.stringify({
              locale: detectPromptLocale(payload.originalTranscript, payload.language),
              timezone: payload.timezone || 'UTC',
              now: nowFactory().toISOString(),
              nowLocal: dayjs(nowFactory()).format('YYYY-MM-DD HH:mm:ss'),
              transcript: payload.originalTranscript,
              currentRuleParse: payload.currentRuleParse,
              llmReason: payload.llmReason,
              appVersion: payload.appVersion || 'dev',
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw createGatewayError(502, 'provider_error', `Provider request failed with status ${response.status}`);
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

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }

  async function handleParseRequest(payload) {
    if (!payload || typeof payload !== 'object') {
      throw createGatewayError(400, 'invalid_request', 'Request body must be a JSON object.');
    }

    if (!payload.currentRuleParse || typeof payload.currentRuleParse !== 'object') {
      throw createGatewayError(400, 'invalid_request', 'currentRuleParse is required.');
    }

    const transcript =
      typeof payload.originalTranscript === 'string'
        ? payload.originalTranscript.trim()
        : typeof payload.normalizedTranscript === 'string'
          ? payload.normalizedTranscript.trim()
          : '';

    if (!transcript) {
      throw createGatewayError(400, 'invalid_request', 'originalTranscript is required.');
    }

    const baseParse = {
      title:
        typeof payload.currentRuleParse.title === 'string'
          ? payload.currentRuleParse.title
          : 'New reminder',
      categorySuggestion:
        typeof payload.currentRuleParse.categorySuggestion === 'string'
          ? payload.currentRuleParse.categorySuggestion
          : 'other',
      eventAt:
        typeof payload.currentRuleParse.eventAt === 'string'
          ? payload.currentRuleParse.eventAt
          : null,
      offsetMinutes:
        typeof payload.currentRuleParse.offsetMinutes === 'number'
          ? payload.currentRuleParse.offsetMinutes
          : 0,
      confidence:
        typeof payload.currentRuleParse.confidence === 'number'
          ? payload.currentRuleParse.confidence
          : 0.7,
      missingFields: Array.isArray(payload.currentRuleParse.missingFields)
        ? payload.currentRuleParse.missingFields.filter((item) => typeof item === 'string')
        : [],
      recurrenceSuggestion:
        typeof payload.currentRuleParse.recurrenceSuggestion === 'string'
          ? payload.currentRuleParse.recurrenceSuggestion
          : 'none',
    };

    if (!payload.llmReason && baseParse.confidence >= 0.88 && baseParse.missingFields.length === 0) {
      return buildBaseResponse(baseParse, {
        modelTier: 'none',
        parsePath: 'rules_only',
        cacheHit: false,
      });
    }

    if (!config.baseUrl || !config.apiKey || !config.miniModel) {
      throw createGatewayError(503, 'provider_not_configured', 'Provider is not configured.');
    }

    const cacheKey = buildCacheKey(
      {
        ...payload,
        originalTranscript: transcript,
      },
      nowFactory
    );
    const cached = readCache(cache, cacheKey, nowFactory);
    if (cached) {
      return {
        ...cached,
        cacheHit: true,
        parsePath: 'cache_hit',
      };
    }

    const miniPayload = await requestChatCompletion(config.miniModel, {
      ...payload,
      originalTranscript: transcript,
      currentRuleParse: baseParse,
    });

    if (!miniPayload) {
      throw createGatewayError(502, 'invalid_provider_payload', 'Provider returned invalid JSON.');
    }

    let result = buildNormalizedResponse(miniPayload, baseParse, {
      modelTier: 'mini',
      parsePath: 'mini_model',
      cacheHit: false,
    });

    if (
      needsStrongModel(result, baseParse) &&
      config.strongModel &&
      config.strongModel !== config.miniModel
    ) {
      const strongPayload = await requestChatCompletion(config.strongModel, {
        ...payload,
        originalTranscript: transcript,
        currentRuleParse: baseParse,
      });

      if (strongPayload) {
        result = buildNormalizedResponse(strongPayload, baseParse, {
          modelTier: 'strong',
          parsePath: 'strong_model',
          cacheHit: false,
        });
      }
    }

    writeCache(cache, cacheKey, transcript, result, nowFactory);
    return result;
  }

  function getHealth() {
    return {
      ok: true,
      providerConfigured: Boolean(config.baseUrl && config.apiKey && config.miniModel),
      cacheSize: cache.size,
      miniModel: config.miniModel || null,
      strongModel: config.strongModel || null,
      now: nowFactory().toISOString(),
    };
  }

  return {
    handleParseRequest,
    getHealth,
    cache,
    config,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function createHttpServer(gateway) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, JSON_HEADERS);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    const isParseRoute = req.method === 'POST' && (url.pathname === '/' || url.pathname === '/parse');
    const isHealthRoute = req.method === 'GET' && url.pathname === '/health';

    if (isHealthRoute) {
      sendJson(res, 200, gateway.getHealth());
      return;
    }

    if (!isParseRoute) {
      sendJson(res, 404, {
        error: 'not_found',
        message: 'Use POST /parse for parsing or GET /health for status.',
      });
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy(createGatewayError(413, 'payload_too_large', 'Request body is too large.'));
      }
    });

    req.on('error', (error) => {
      sendJson(res, error.statusCode || 500, {
        error: error.code || 'request_error',
        message: error.message || 'Request failed.',
      });
    });

    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : null;
        const response = await gateway.handleParseRequest(payload);
        sendJson(res, 200, response);
      } catch (error) {
        sendJson(res, error.statusCode || 500, {
          error: error.code || 'internal_error',
          message: error.message || 'Unexpected gateway error.',
        });
      }
    });
  });
}

module.exports = {
  createParseGateway,
  createHttpServer,
  normalizeArabicText,
  buildCacheKey,
};
