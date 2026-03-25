const test = require('node:test');
const assert = require('node:assert/strict');
const dayjs = require('dayjs');

const { parseReminderRules } = require('../src/utils/parser.ts');

function expectDatePart(isoString, expectedDay) {
  assert.equal(dayjs(isoString).format('YYYY-MM-DD'), expectedDay.format('YYYY-MM-DD'));
}

test('parses Egyptian Arabic shopping reminder with tomorrow, time, and offset', () => {
  const result = parseReminderRules('فكرني اشتري مقاضي بكرة الساعة 5 العصر قبل نص ساعة');

  assert.equal(result.title, 'اشتري مقاضي');
  assert.equal(result.categorySuggestion, 'shopping');
  assert.equal(result.offsetMinutes, 30);
  assert.equal(result.recurrenceSuggestion, 'none');
  assert.deepEqual(result.missingFields, []);
  assert.equal(dayjs(result.eventAt).hour(), 17);
  assert.equal(dayjs(result.eventAt).minute(), 0);
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});

test('parses Arabic work reminder with a named weekday and evening time', () => {
  const result = parseReminderRules('فكرني ابعت الايميل الخميس الساعة 8 بالليل');

  assert.equal(result.title, 'ابعت الايميل');
  assert.equal(result.categorySuggestion, 'work');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
  assert.equal(dayjs(result.eventAt).hour(), 20);
  assert.equal(dayjs(result.eventAt).minute(), 0);
  assert.equal(dayjs(result.eventAt).day(), 4);
});

test('parses Arabic daily recurrence without forcing a missing date', () => {
  const result = parseReminderRules('فكرني اشرب ميه كل يوم الساعة 9 الصبح');

  assert.equal(result.title, 'اشرب ميه');
  assert.equal(result.categorySuggestion, 'health');
  assert.equal(result.recurrenceSuggestion, 'daily');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 9);
});

test('parses Arabic weekdays recurrence without forcing a missing date', () => {
  const result = parseReminderRules('فكرني standup كل يوم شغل الساعة 10 الصبح');

  assert.equal(result.recurrenceSuggestion, 'weekdays');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 10);
});

test('keeps Arabic missing-time behavior when only the day is clear', () => {
  const result = parseReminderRules('فكرني ادفع الايجار بكرة');

  assert.equal(result.title, 'ادفع الايجار');
  assert.equal(result.categorySuggestion, 'finance');
  assert.ok(result.missingFields.includes('time'));
  assert.ok(!result.missingFields.includes('date'));
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});

test('normalizes colloquial Arabic imperative call phrasing into a clearer task title', () => {
  const result = parseReminderRules('كلم احمد بكرة 5');

  assert.equal(result.title, 'اكلم احمد');
  assert.equal(result.categorySuggestion, 'personal');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 5);
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});

test('keeps a clear task title for colloquial Arabic action verbs even when time is missing', () => {
  const result = parseReminderRules('هات الدوا');

  assert.equal(result.title, 'هات الدوا');
  assert.equal(result.categorySuggestion, 'health');
  assert.ok(result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
});

test('parses colloquial Arabic movement phrasing without collapsing the title', () => {
  const result = parseReminderRules('روح الجيم بكرة');

  assert.equal(result.title, 'اروح الجيم');
  assert.equal(result.categorySuggestion, 'health');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});
