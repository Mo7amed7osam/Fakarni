const test = require('node:test');
const assert = require('node:assert/strict');

const { createHttpServer, createParseGateway } = require('../gateway/parse-gateway.cjs');

function createMockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function createGateway(overrides = {}) {
  const fetchCalls = [];
  const gateway = createParseGateway({
    baseUrl: 'https://example.com',
    apiKey: 'test-key',
    miniModel: 'mini-model',
    strongModel: 'strong-model',
    nowFactory: overrides.nowFactory || (() => new Date('2026-03-26T10:00:00.000Z')),
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      if (overrides.fetchImpl) {
        return overrides.fetchImpl(url, options, fetchCalls.length - 1);
      }

      return createMockResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'اكلم احمد',
                category: 'personal',
                eventAt: '2026-03-26T10:02:00.000Z',
                offsetMinutes: 0,
                recurrence: 'none',
                confidence: 0.95,
                missingFields: [],
              }),
            },
          },
        ],
      });
    },
  });

  return { gateway, fetchCalls };
}

async function withGatewayServer(gateway, run) {
  const server = createHttpServer(gateway);
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test('gateway returns rules-only result without model call when llmReason is absent', async () => {
  const { gateway, fetchCalls } = createGateway();

  const result = await gateway.handleParseRequest({
    originalTranscript: 'اكلم احمد بكرة 5',
    normalizedTranscript: 'اكلم احمد بكره 5',
    language: 'ar-EG',
    timezone: 'Africa/Cairo',
    appVersion: '1.0.0',
    currentRuleParse: {
      title: 'اكلم احمد',
      categorySuggestion: 'personal',
      eventAt: '2026-03-27T15:00:00.000Z',
      offsetMinutes: 0,
      confidence: 0.93,
      missingFields: [],
      recurrenceSuggestion: 'none',
    },
  });

  assert.equal(result.parsePath, 'rules_only');
  assert.equal(result.modelTier, 'none');
  assert.equal(fetchCalls.length, 0);
});

test('gateway caches repeated parse requests', async () => {
  const { gateway, fetchCalls } = createGateway();
  const payload = {
    originalTranscript: 'اكلم احمد كمان دقيقتين',
    normalizedTranscript: 'اكلم احمد كمان دقيقتين',
    language: 'ar-EG',
    timezone: 'Africa/Cairo',
    appVersion: '1.0.0',
    llmReason: 'relative_time_ambiguous',
    currentRuleParse: {
      title: 'اكلم احمد',
      categorySuggestion: 'personal',
      eventAt: '2026-03-26T10:02:00.000Z',
      offsetMinutes: 0,
      confidence: 0.82,
      missingFields: [],
      recurrenceSuggestion: 'none',
    },
  };

  const first = await gateway.handleParseRequest(payload);
  const second = await gateway.handleParseRequest(payload);

  assert.equal(first.parsePath, 'mini_model');
  assert.equal(second.parsePath, 'cache_hit');
  assert.equal(second.cacheHit, true);
  assert.equal(fetchCalls.length, 1);
});

test('gateway escalates once to strong model when mini result stays weak', async () => {
  const { gateway, fetchCalls } = createGateway({
    fetchImpl: async (_url, _options, index) => {
      if (index === 0) {
        return createMockResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'اكلم احمد',
                  category: 'personal',
                  eventAt: '2026-03-26T10:02:00.000Z',
                  offsetMinutes: 0,
                  recurrence: 'none',
                  confidence: 0.76,
                  missingFields: ['time'],
                }),
              },
            },
          ],
        });
      }

      return createMockResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'اكلم احمد',
                category: 'personal',
                eventAt: '2026-03-26T10:02:00.000Z',
                offsetMinutes: 0,
                recurrence: 'none',
                confidence: 0.95,
                missingFields: [],
              }),
            },
          },
        ],
      });
    },
  });

  const result = await gateway.handleParseRequest({
    originalTranscript: 'اكلم احمد كمان دقيقتين',
    normalizedTranscript: 'اكلم احمد كمان دقيقتين',
    language: 'ar-EG',
    timezone: 'Africa/Cairo',
    appVersion: '1.0.0',
    llmReason: 'low_confidence',
    currentRuleParse: {
      title: 'اكلم احمد',
      categorySuggestion: 'personal',
      eventAt: '2026-03-26T10:02:00.000Z',
      offsetMinutes: 0,
      confidence: 0.75,
      missingFields: [],
      recurrenceSuggestion: 'none',
    },
  });

  assert.equal(result.parsePath, 'strong_model');
  assert.equal(result.modelTier, 'strong');
  assert.equal(fetchCalls.length, 2);
});

test('gateway prompt includes Egyptian Arabic time-of-day conventions', async () => {
  const { gateway, fetchCalls } = createGateway();

  await gateway.handleParseRequest({
    originalTranscript: 'فكرني الساعة واحدة الضهر',
    normalizedTranscript: 'فكرني الساعه واحده الضهر',
    language: 'ar-EG',
    timezone: 'Africa/Cairo',
    appVersion: '1.0.0',
    llmReason: 'missing_fields',
    currentRuleParse: {
      title: 'تذكير جديد',
      categorySuggestion: 'other',
      eventAt: null,
      offsetMinutes: 0,
      confidence: 0.6,
      missingFields: ['title', 'time'],
      recurrenceSuggestion: 'none',
    },
  });

  const requestBody = JSON.parse(fetchCalls[0].options.body);
  const systemPrompt = requestBody.messages[0].content;

  assert.match(systemPrompt, /1 الضهر or 1 الظهر means 13:00/);
  assert.match(systemPrompt, /1 بالليل or 1 بليل means 01:00/);
  assert.match(systemPrompt, /coarse time windows/);
});

test('gateway returns provider_not_configured when model config is missing', async () => {
  const gateway = createParseGateway({
    baseUrl: '',
    apiKey: '',
    miniModel: '',
    strongModel: '',
    fetchImpl: async () => {
      throw new Error('should not be called');
    },
  });

  await assert.rejects(
    () =>
      gateway.handleParseRequest({
        originalTranscript: 'pay rent tomorrow',
        normalizedTranscript: 'pay rent tomorrow',
        language: 'en-US',
        timezone: 'Africa/Cairo',
        appVersion: '1.0.0',
        llmReason: 'missing_fields',
        currentRuleParse: {
          title: 'pay rent',
          categorySuggestion: 'finance',
          eventAt: null,
          offsetMinutes: 0,
          confidence: 0.72,
          missingFields: ['time'],
          recurrenceSuggestion: 'none',
        },
      }),
    (error) => error.code === 'provider_not_configured'
  );
});

test('http server exposes health and parse routes', async () => {
  const { gateway } = createGateway();

  await withGatewayServer(gateway, async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.ok, true);
    assert.equal(health.providerConfigured, true);

    const parseResponse = await fetch(`${baseUrl}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originalTranscript: 'اكلم احمد كمان دقيقتين',
        normalizedTranscript: 'اكلم احمد كمان دقيقتين',
        language: 'ar-EG',
        timezone: 'Africa/Cairo',
        appVersion: '1.0.0',
        llmReason: 'relative_time_ambiguous',
        currentRuleParse: {
          title: 'اكلم احمد',
          categorySuggestion: 'personal',
          eventAt: '2026-03-26T10:02:00.000Z',
          offsetMinutes: 0,
          confidence: 0.82,
          missingFields: [],
          recurrenceSuggestion: 'none',
        },
      }),
    });

    assert.equal(parseResponse.status, 200);
    const parsed = await parseResponse.json();
    assert.equal(parsed.modelTier, 'mini');
    assert.equal(parsed.parsePath, 'mini_model');
  });
});

test('http server returns a clear error shape for invalid payloads', async () => {
  const { gateway } = createGateway();

  await withGatewayServer(gateway, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentRuleParse: {},
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, 'invalid_request');
    assert.match(payload.message, /originalTranscript is required/i);
  });
});
