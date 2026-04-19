import { FeedbackReason, FeedbackTriggerSource } from '../types';

export interface FeedbackSubmissionPayload {
  source: FeedbackTriggerSource;
  reason: FeedbackReason;
  note?: string;
  timestamp: string;
  appVersion: string;
  appBuild: string;
  platform: 'ios' | 'android';
  locale: string;
}

export type FeedbackSubmissionErrorCode =
  | 'note_required'
  | 'not_configured'
  | 'request_failed';

export class FeedbackSubmissionError extends Error {
  code: FeedbackSubmissionErrorCode;

  constructor(code: FeedbackSubmissionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

interface FeedbackGoogleFormConfig {
  actionUrl: string;
  sourceEntryId: string;
  reasonEntryId: string;
  noteEntryId: string;
  timestampEntryId: string;
  appVersionEntryId: string;
  appBuildEntryId: string;
  platformEntryId: string;
  localeEntryId: string;
}

type FeedbackGoogleFormEnv = Record<string, string | undefined>;

function normalizeEntryId(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('entry.') ? trimmed : `entry.${trimmed}`;
}

function requireEnvValue(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function resolveFeedbackGoogleFormConfig(
  env: FeedbackGoogleFormEnv = process.env
): FeedbackGoogleFormConfig | null {
  const actionUrl = requireEnvValue(env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_ACTION_URL);
  const sourceEntryId = requireEnvValue(
    env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_SOURCE_ENTRY_ID
  );
  const reasonEntryId = requireEnvValue(
    env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_REASON_ENTRY_ID
  );
  const noteEntryId = requireEnvValue(env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_NOTE_ENTRY_ID);
  const timestampEntryId = requireEnvValue(
    env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_TIMESTAMP_ENTRY_ID
  );
  const appVersionEntryId = requireEnvValue(
    env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_APP_VERSION_ENTRY_ID
  );
  const appBuildEntryId = requireEnvValue(
    env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_APP_BUILD_ENTRY_ID
  );
  const platformEntryId = requireEnvValue(
    env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_PLATFORM_ENTRY_ID
  );
  const localeEntryId = requireEnvValue(
    env.EXPO_PUBLIC_FEEDBACK_GOOGLE_FORM_LOCALE_ENTRY_ID
  );

  if (
    !actionUrl ||
    !sourceEntryId ||
    !reasonEntryId ||
    !noteEntryId ||
    !timestampEntryId ||
    !appVersionEntryId ||
    !appBuildEntryId ||
    !platformEntryId ||
    !localeEntryId
  ) {
    return null;
  }

  return {
    actionUrl,
    sourceEntryId: normalizeEntryId(sourceEntryId),
    reasonEntryId: normalizeEntryId(reasonEntryId),
    noteEntryId: normalizeEntryId(noteEntryId),
    timestampEntryId: normalizeEntryId(timestampEntryId),
    appVersionEntryId: normalizeEntryId(appVersionEntryId),
    appBuildEntryId: normalizeEntryId(appBuildEntryId),
    platformEntryId: normalizeEntryId(platformEntryId),
    localeEntryId: normalizeEntryId(localeEntryId),
  };
}

export function validateFeedbackSubmissionPayload(
  payload: Pick<FeedbackSubmissionPayload, 'reason' | 'note'>
) {
  const normalizedNote = payload.note?.trim();

  if (payload.reason === 'other' && !normalizedNote) {
    throw new FeedbackSubmissionError(
      'note_required',
      'A note is required when the selected reason is other.'
    );
  }

  return {
    ...payload,
    note: normalizedNote || undefined,
  };
}

export function buildFeedbackGoogleFormBody(
  payload: FeedbackSubmissionPayload,
  config: FeedbackGoogleFormConfig
) {
  const validated = validateFeedbackSubmissionPayload(payload);
  const params = new URLSearchParams();

  params.append(config.sourceEntryId, payload.source);
  params.append(config.reasonEntryId, payload.reason);
  params.append(config.timestampEntryId, payload.timestamp);
  params.append(config.appVersionEntryId, payload.appVersion);
  params.append(config.appBuildEntryId, payload.appBuild);
  params.append(config.platformEntryId, payload.platform);
  params.append(config.localeEntryId, payload.locale);

  if (validated.note) {
    params.append(config.noteEntryId, validated.note);
  }

  return params.toString();
}

export function isFeedbackSubmissionConfigured(
  env: FeedbackGoogleFormEnv = process.env
) {
  return Boolean(resolveFeedbackGoogleFormConfig(env));
}

export async function submitFeedbackToGoogleForm(
  payload: FeedbackSubmissionPayload,
  options: {
    env?: FeedbackGoogleFormEnv;
    fetchImpl?: typeof fetch;
  } = {}
) {
  const config = resolveFeedbackGoogleFormConfig(options.env);
  if (!config) {
    throw new FeedbackSubmissionError(
      'not_configured',
      'Feedback submission is not configured.'
    );
  }

  const fetchImpl = options.fetchImpl ?? global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new FeedbackSubmissionError(
      'request_failed',
      'Fetch is unavailable for feedback submission.'
    );
  }

  const body = buildFeedbackGoogleFormBody(payload, config);

  let response: Response;
  try {
    response = await fetchImpl(config.actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body,
    });
  } catch (error) {
    throw new FeedbackSubmissionError(
      'request_failed',
      error instanceof Error ? error.message : 'Feedback submission failed.'
    );
  }

  if (
    typeof response.status !== 'number' ||
    Number.isNaN(response.status) ||
    response.status < 200 ||
    response.status >= 400
  ) {
    throw new FeedbackSubmissionError(
      'request_failed',
      `Feedback submission failed with status ${response.status}.`
    );
  }
}
