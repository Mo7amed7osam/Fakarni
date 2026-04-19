const test = require('node:test');
const assert = require('node:assert/strict');
const dayjs = require('dayjs');

const { parseReminderRules } = require('../src/utils/parser.ts');

function expectDatePart(isoString, expectedDay) {
  assert.equal(dayjs(isoString).format('YYYY-MM-DD'), expectedDay.format('YYYY-MM-DD'));
}

function expectNearFutureMinutes(isoString, minMinutes, maxMinutes) {
  const now = dayjs();
  const diffSeconds = dayjs(isoString).diff(now, 'second');
  assert.ok(
    diffSeconds >= minMinutes * 60 && diffSeconds <= maxMinutes * 60,
    `expected ${isoString} to be between ${minMinutes} and ${maxMinutes} minutes in the future`
  );
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

  assert.equal(result.title, 'كلم احمد');
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

  assert.equal(result.title, 'روح الجيم');
  assert.equal(result.categorySuggestion, 'health');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});

test('parses Arabic relative future phrases as event time, not offset', () => {
  const result = parseReminderRules('اكلم احمد كمان دقيقتين');

  assert.equal(result.title, 'كلم احمد');
  assert.equal(result.categorySuggestion, 'personal');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
  expectNearFutureMinutes(result.eventAt, 1, 3);
});

test('parses Arabic one-minute relative future safely for auto-save', () => {
  const result = parseReminderRules('فكرني اكلم احمد كمان دقيقه');

  assert.equal(result.title, 'كلم احمد');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
  expectNearFutureMinutes(result.eventAt, 1, 2);
});

test('parses Arabic after-minutes phrasing as a future event time', () => {
  const result = parseReminderRules('بعد 10 دقايق ابعت الايميل');

  assert.equal(result.title, 'ابعت الايميل');
  assert.equal(result.categorySuggestion, 'work');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
  expectNearFutureMinutes(result.eventAt, 8, 11);
});

test('parses Arabic after-hour phrasing as a future event time', () => {
  const result = parseReminderRules('ادفع الايجار بعد ساعه');

  assert.equal(result.title, 'ادفع الايجار');
  assert.equal(result.categorySuggestion, 'finance');
  assert.equal(result.offsetMinutes, 0);
  assert.deepEqual(result.missingFields, []);
  expectNearFutureMinutes(result.eventAt, 58, 61);
});

test('parses Egyptian Arabic noon wording like الواحدة الضهر as 1 pm', () => {
  const result = parseReminderRules('فكرني اكلم احمد الساعه الواحده الضهر');

  assert.equal(result.title, 'كلم احمد');
  assert.equal(result.categorySuggestion, 'personal');
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 13);
  assert.equal(dayjs(result.eventAt).minute(), 0);
});

test('parses Egyptian Arabic night wording like الواحدة بالليل as 1 am', () => {
  const result = parseReminderRules('فكرني اكلم احمد الساعه الواحده بالليل');

  assert.equal(result.title, 'كلم احمد');
  assert.equal(result.categorySuggestion, 'personal');
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 1);
  assert.equal(dayjs(result.eventAt).minute(), 0);
});

test('parses Egyptian Arabic afternoon wording like 5 العصر as 5 pm', () => {
  const result = parseReminderRules('كلمني 5 العصر');

  assert.equal(result.title, 'كلمني');
  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 17);
});

test('parses Egyptian Arabic dinner wording like 8 العشا as night context', () => {
  const result = parseReminderRules('فكرني 8 العشا اذاكر');

  assert.ok(!result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 20);
});

test('treats بكرة الصبح as a coarse morning window and keeps manual review', () => {
  const result = parseReminderRules('فكرني اكلم احمد بكرة الصبح');

  assert.equal(result.title, 'كلم احمد');
  assert.equal(result.categorySuggestion, 'personal');
  assert.ok(!result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 8);
  expectDatePart(result.eventAt, dayjs().add(1, 'day'));
});

test('normalizes first-person Arabic doctor reminder titles into task phrasing', () => {
  const result = parseReminderRules('فكرني أروح للدكتور');

  assert.equal(result.title, 'روح للدكتور');
  assert.ok(result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
});

test('keeps Arabic buy reminder titles clean without over-rewriting them', () => {
  const result = parseReminderRules('فكرني أشتري لبن');

  assert.equal(result.title, 'اشتري لبن');
  assert.ok(result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
});

test('normalizes first-person Arabic call reminder titles into task phrasing', () => {
  const result = parseReminderRules('فكرني أكلم أحمد');

  assert.equal(result.title, 'كلم احمد');
  assert.equal(result.categorySuggestion, 'personal');
});

test('normalizes first-person Arabic review reminder titles into task phrasing', () => {
  const result = parseReminderRules('فكرني أراجع الدرس');

  assert.equal(result.title, 'راجع الدرس');
  assert.equal(result.categorySuggestion, 'study');
});

test('keeps Arabic email reminder titles readable when imperative and spoken forms match', () => {
  const result = parseReminderRules('فكرني أبعَت الإيميل');

  assert.equal(result.title, 'ابعت الايميل');
  assert.equal(result.categorySuggestion, 'work');
});

test('normalizes first-person Arabic finish reminder titles into task phrasing', () => {
  const result = parseReminderRules('فكرني أخلص الشغل');

  assert.equal(result.title, 'خلص الشغل');
});

test('keeps Arabic exercise titles unchanged when the safest task phrasing already matches', () => {
  const result = parseReminderRules('فكرني أتمرن');

  assert.equal(result.title, 'اتمرن');
  assert.equal(result.categorySuggestion, 'health');
});

test('keeps Arabic go-down phrasing unchanged when imperative rewriting would be ambiguous', () => {
  const result = parseReminderRules('فكرني أنزل الجيم');

  assert.equal(result.title, 'انزل الجيم');
  assert.equal(result.categorySuggestion, 'health');
});

test('does not rewrite noun-led Arabic titles that only happen to start with alif', () => {
  const result = parseReminderRules('فكرني امير يراجع العقد');

  assert.equal(result.title, 'امير يراجع العقد');
});

test('treats بعد بكرة العصر as a coarse afternoon window and keeps manual review', () => {
  const result = parseReminderRules('فكرني بعد بكره العصر');

  assert.ok(!result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 17);
  expectDatePart(result.eventAt, dayjs().add(2, 'day'));
});

test('treats بعد المغرب as a coarse evening window instead of a precise time', () => {
  const result = parseReminderRules('ذكرني بعد المغرب');

  assert.ok(result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 19);
  assert.ok(result.confidence < 0.8);
});

test('treats النهارده بالليل as today plus a coarse night window', () => {
  const result = parseReminderRules('فكرني النهارده بالليل');

  assert.ok(!result.missingFields.includes('date'));
  assert.ok(result.missingFields.includes('time'));
  assert.equal(dayjs(result.eventAt).hour(), 21);
  expectDatePart(result.eventAt, dayjs());
});
