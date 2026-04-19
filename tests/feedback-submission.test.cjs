const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FeedbackSubmissionError,
  buildFeedbackGoogleFormBody,
  resolveFeedbackGoogleFormConfig,
  submitFeedbackToGoogleForm,
} = require('../src/services/feedback.ts');

function createEnv(overrides = {}) {
  return {
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_ACTION_URL:
      'https://docs.google.com/forms/d/e/example-form-id/formResponse',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_SOURCE_ENTRY_ID: 'entry.111111111',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_REASON_ENTRY_ID: 'entry.222222222',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_NOTE_ENTRY_ID: 'entry.333333333',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_TIMESTAMP_ENTRY_ID: 'entry.444444444',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_APP_VERSION_ENTRY_ID: 'entry.555555555',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_APP_BUILD_ENTRY_ID: 'entry.666666666',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_PLATFORM_ENTRY_ID: 'entry.777777777',
    EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_LOCALE_ENTRY_ID: 'entry.888888888',
    ...overrides,
  };
}

function createPayload(overrides = {}) {
  return {
    source: 'settings_manual',
    reason: 'timing',
    note: 'The reminder fired late.',
    timestamp: '2026-04-19T12:00:00.000Z',
    appVersion: '1.0.0',
    appBuild: '42',
    platform: 'ios',
    locale: 'ar-EG',
    ...overrides,
  };
}

test('builds the correct Google Form body from a valid payload', () => {
  const config = resolveFeedbackGoogleFormConfig(createEnv());
  const body = buildFeedbackGoogleFormBody(createPayload(), config);
  const params = new URLSearchParams(body);

  assert.equal(
    params.get('entry.111111111'),
    'settings_manual'
  );
  assert.equal(params.get('entry.222222222'), 'timing');
  assert.equal(params.get('entry.333333333'), 'The reminder fired late.');
  assert.equal(params.get('entry.444444444'), '2026-04-19T12:00:00.000Z');
  assert.equal(params.get('entry.555555555'), '1.0.0');
  assert.equal(params.get('entry.666666666'), '42');
  assert.equal(params.get('entry.777777777'), 'ios');
  assert.equal(params.get('entry.888888888'), 'ar-EG');
});

test('omits the note field when the note is blank for non-other reasons', () => {
  const config = resolveFeedbackGoogleFormConfig(createEnv());
  const body = buildFeedbackGoogleFormBody(
    createPayload({
      note: '   ',
      reason: 'calendar',
    }),
    config
  );
  const params = new URLSearchParams(body);

  assert.equal(params.get('entry.222222222'), 'calendar');
  assert.equal(params.has('entry.333333333'), false);
});

test('rejects other without a note', () => {
  const config = resolveFeedbackGoogleFormConfig(createEnv());

  assert.throws(
    () =>
      buildFeedbackGoogleFormBody(
        createPayload({
          reason: 'other',
          note: '   ',
        }),
        config
      ),
    (error) =>
      error instanceof FeedbackSubmissionError && error.code === 'note_required'
  );
});

test('fails cleanly when env config is incomplete', async () => {
  await assert.rejects(
    () =>
      submitFeedbackToGoogleForm(createPayload(), {
        env: createEnv({
          EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_ACTION_URL: '',
        }),
        fetchImpl: async () => {
          throw new Error('should not be called');
        },
      }),
    (error) =>
      error instanceof FeedbackSubmissionError && error.code === 'not_configured'
  );
});

test('treats non-success submission responses as failure', async () => {
  await assert.rejects(
    () =>
      submitFeedbackToGoogleForm(createPayload(), {
        env: createEnv(),
        fetchImpl: async () => ({
          status: 500,
        }),
      }),
    (error) =>
      error instanceof FeedbackSubmissionError && error.code === 'request_failed'
  );
});
