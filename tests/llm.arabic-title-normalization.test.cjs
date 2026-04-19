const test = require('node:test');
const assert = require('node:assert/strict');

function loadLLMModule() {
  const llmPath = require.resolve('../src/services/llm.ts');
  delete require.cache[llmPath];
  return require(llmPath);
}

test('refineParseWithLLM normalizes Arabic gateway titles into task phrasing', async () => {
  const originalGatewayUrl = process.env.EXPO_PUBLIC_PARSE_GATEWAY_URL;
  const originalFetch = global.fetch;

  process.env.EXPO_PUBLIC_PARSE_GATEWAY_URL = 'https://example.com/parse';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        title: 'أكلم أحمد',
        category: 'personal',
        eventAt: '2026-04-20T09:00:00.000Z',
        offsetMinutes: 0,
        recurrence: 'none',
        confidence: 0.95,
        missingFields: [],
        modelTier: 'mini',
        parsePath: 'mini_model',
      };
    },
  });

  try {
    const { refineParseWithLLM } = loadLLMModule();
    const result = await refineParseWithLLM(
      'فكرني أكلم أحمد بكرة الساعة 9',
      {
        title: 'كلم احمد',
        eventAt: '2026-04-20T09:00:00.000Z',
        remindAt: '2026-04-20T09:00:00.000Z',
        categorySuggestion: 'personal',
        offsetMinutes: 0,
        confidence: 0.7,
        needsConfirmation: true,
        missingFields: [],
        recurrenceSuggestion: 'none',
        source: 'rules',
        llmUsed: false,
        cacheHit: false,
        modelTier: 'none',
        parsePath: 'review_required',
      },
      'missing_fields'
    );

    assert.ok(result);
    assert.equal(result.title, 'كلم احمد');
    assert.equal(result.source, 'llm');
    assert.equal(result.parsePath, 'mini_model');
  } finally {
    global.fetch = originalFetch;
    if (originalGatewayUrl === undefined) {
      delete process.env.EXPO_PUBLIC_PARSE_GATEWAY_URL;
    } else {
      process.env.EXPO_PUBLIC_PARSE_GATEWAY_URL = originalGatewayUrl;
    }
  }
});
