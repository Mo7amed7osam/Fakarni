const test = require('node:test');
const assert = require('node:assert/strict');
const dayjs = require('dayjs');

const { parseReminderRules } = require('../src/utils/parser.ts');

function expectDatePart(isoString, expectedDay) {
  assert.equal(dayjs(isoString).format('YYYY-MM-DD'), expectedDay.format('YYYY-MM-DD'));
}

test('parses English shopping reminder with tomorrow, time, and offset', () => {
  const result = parseReminderRules('Remind me to buy groceries tomorrow at 5 pm 30 minutes before');

  assert.equal(result.title, 'buy groceries');
  assert.equal(result.categorySuggestion, 'shopping');
  assert.equal(result.offsetMinutes, 30);
  assert.equal(result.recurrenceSuggestion, 'none');
  assert.deepEqual(result.missingFields, []);
  assert.equal(dayjs(result.eventAt).hour(), 17);
  assert.equal(dayjs(result.eventAt).minute(), 0);
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});

test('parses English personal reminder with next weekday phrasing', () => {
  const result = parseReminderRules('Remind me to call mom next monday at 8 pm');

  assert.equal(result.title, 'call mom');
  assert.equal(result.categorySuggestion, 'personal');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
  assert.equal(dayjs(result.eventAt).hour(), 20);
  assert.equal(dayjs(result.eventAt).minute(), 0);
  assert.equal(dayjs(result.eventAt).day(), 1);
});

test('parses English daily recurrence without forcing a missing date', () => {
  const result = parseReminderRules('Remind me to go to the gym every day at 7 am');

  assert.equal(result.title, 'go to the gym');
  assert.equal(result.categorySuggestion, 'health');
  assert.equal(result.recurrenceSuggestion, 'daily');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 7);
});

test('parses English weekdays recurrence without forcing a missing date', () => {
  const result = parseReminderRules('Remind me to standup on weekdays at 9 am');

  assert.equal(result.title, 'standup on');
  assert.equal(result.recurrenceSuggestion, 'weekdays');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 9);
});

test('keeps English missing-time behavior when only the day is clear', () => {
  const result = parseReminderRules('Remind me to pay rent tomorrow');

  assert.equal(result.title, 'pay rent');
  assert.equal(result.categorySuggestion, 'finance');
  assert.ok(result.missingFields.includes('time'));
  assert.ok(!result.missingFields.includes('date'));
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});
