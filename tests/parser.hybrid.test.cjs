const test = require('node:test');
const assert = require('node:assert/strict');
const dayjs = require('dayjs');

function loadParserWithMock(refineImpl) {
  const llmPath = require.resolve('../src/services/llm.ts');
  const parserPath = require.resolve('../src/utils/parser.ts');

  delete require.cache[llmPath];
  delete require.cache[parserPath];

  const llmModule = require(llmPath);
  llmModule.refineParseWithLLM = refineImpl;

  return require(parserPath);
}

test('parseReminderText falls back to rules when LLM returns null', async () => {
  const { parseReminderText, parseReminderRules } = loadParserWithMock(async () => null);
  const transcript = 'Remind me to buy groceries tomorrow at 5 pm';

  const hybridResult = await parseReminderText(transcript);
  const ruleResult = parseReminderRules(transcript);

  assert.deepEqual(hybridResult, ruleResult);
  assert.equal(hybridResult.source, 'rules');
});

test('parseReminderText returns hybrid result when LLM successfully refines missing fields', async () => {
  let receivedBaseParse = null;
  const targetEventAt = dayjs().add(1, 'day').hour(17).minute(0).second(0).millisecond(0);

  const { parseReminderText } = loadParserWithMock(async (transcript, baseParse) => {
    receivedBaseParse = baseParse;

    return {
      ...baseParse,
      title: 'buy groceries',
      eventAt: targetEventAt.toISOString(),
      remindAt: targetEventAt.subtract(30, 'minute').toISOString(),
      categorySuggestion: 'shopping',
      offsetMinutes: 30,
      confidence: 0.95,
      missingFields: [],
      recurrenceSuggestion: 'none',
      source: 'llm',
      needsConfirmation: false,
    };
  });

  const result = await parseReminderText('Remind me to buy groceries tomorrow');

  assert.equal(result.source, 'hybrid');
  assert.equal(result.title, 'buy groceries');
  assert.equal(result.categorySuggestion, 'shopping');
  assert.equal(result.offsetMinutes, 30);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.needsConfirmation, false);
  assert.equal(receivedBaseParse.missingFields.includes('time'), true);
});

test('parseReminderText keeps confirmation required when LLM result is still low confidence', async () => {
  const { parseReminderText } = loadParserWithMock(async (_transcript, baseParse) => ({
    ...baseParse,
    confidence: 0.7,
    missingFields: ['time'],
    source: 'llm',
    needsConfirmation: false,
  }));

  const result = await parseReminderText('Remind me to pay rent tomorrow');

  assert.equal(result.source, 'hybrid');
  assert.equal(result.needsConfirmation, true);
  assert.ok(result.missingFields.includes('time'));
});

test('parseReminderText falls back to rules when LLM throws', async () => {
  const { parseReminderText, parseReminderRules } = loadParserWithMock(async () => {
    throw new Error('LLM unavailable');
  });
  const transcript = 'فكرني اشرب ميه كل يوم الساعة 9 الصبح';

  const hybridResult = await parseReminderText(transcript);
  const ruleResult = parseReminderRules(transcript);

  assert.deepEqual(hybridResult, ruleResult);
  assert.equal(hybridResult.source, 'rules');
});

test('parseReminderText keeps colloquial Arabic rule parsing usable when LLM is unavailable', async () => {
  const { parseReminderText } = loadParserWithMock(async () => {
    throw new Error('LLM unavailable');
  });

  const result = await parseReminderText('كلم احمد بكرة 5');

  assert.equal(result.source, 'rules');
  assert.equal(result.title, 'اكلم احمد');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(!result.missingFields.includes('time'));
});

test('parseReminderText accepts colloquial Arabic normalization from LLM refinement', async () => {
  const { parseReminderText } = loadParserWithMock(async (_transcript, baseParse) => ({
    ...baseParse,
    title: 'اكلم احمد',
    confidence: 0.94,
    missingFields: [],
    source: 'llm',
    needsConfirmation: false,
  }));

  const result = await parseReminderText('كلم احمد بكرة 5');

  assert.equal(result.source, 'hybrid');
  assert.equal(result.title, 'اكلم احمد');
  assert.equal(result.needsConfirmation, false);
});

test('parseReminderText keeps relative-future rule parsing usable when LLM is unavailable', async () => {
  const { parseReminderText } = loadParserWithMock(async () => {
    throw new Error('LLM unavailable');
  });

  const result = await parseReminderText('اكلم احمد كمان دقيقتين');

  assert.equal(result.source, 'rules');
  assert.equal(result.title, 'اكلم احمد');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
});

test('parseReminderText preserves relative-future event semantics when LLM refines the result', async () => {
  const targetEventAt = dayjs().add(2, 'minute').second(0).millisecond(0);
  const { parseReminderText } = loadParserWithMock(async (_transcript, baseParse) => ({
    ...baseParse,
    title: 'اكلم احمد',
    eventAt: targetEventAt.toISOString(),
    remindAt: targetEventAt.toISOString(),
    offsetMinutes: 0,
    confidence: 0.96,
    missingFields: [],
    source: 'llm',
    needsConfirmation: false,
  }));

  const result = await parseReminderText('اكلم احمد كمان دقيقتين');

  assert.equal(result.source, 'hybrid');
  assert.equal(result.title, 'اكلم احمد');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.needsConfirmation, false);
});
