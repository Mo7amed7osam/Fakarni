import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { PostHog, PostHogPersistedProperty } from 'posthog-react-native';
import { Platform } from 'react-native';
import {
  NotificationPermissionState,
  Reminder,
  ReminderDraft,
  SettingsState,
} from '../types';

type AnalyticsPrimitive = string | number | boolean | null;
type AnalyticsPropertyInput = AnalyticsPrimitive | undefined;

export type AnalyticsEventProperties = Record<string, AnalyticsPrimitive>;
export type ReminderEntryPoint = 'voice_home' | 'manual_confirmation' | 'edit';
export type ParseConfidenceBucket = 'low' | 'medium' | 'high';
export type OffsetBucket =
  | 'at_time'
  | 'within_30m'
  | 'within_60m'
  | 'within_120m'
  | 'over_120m';
export type EventTimeBucket = 'night' | 'morning' | 'afternoon' | 'evening';
export type CalendarMode =
  | 'none'
  | 'apple_auto'
  | 'google_connected'
  | 'device_manual';
export type AnalyticsEventName =
  | 'app opened'
  | 'onboarding completed'
  | 'screen viewed'
  | 'microphone tapped'
  | 'voice listening started'
  | 'voice listening ended'
  | 'voice transcript captured'
  | 'reminder parse succeeded'
  | 'reminder parse failed'
  | 'reminder confirmation shown'
  | 'reminder inline auto-save triggered'
  | 'reminder create succeeded'
  | 'reminder create failed'
  | 'reminder updated'
  | 'reminder deleted'
  | 'reminder completed'
  | 'reminder snoozed'
  | 'reminder reopened'
  | 'notification permission requested'
  | 'notification permission changed'
  | 'notification scheduled'
  | 'calendar sync attempted'
  | 'calendar sync succeeded'
  | 'calendar sync failed'
  | 'apple calendar auto-sync toggled'
  | 'google calendar connected'
  | 'google calendar disconnected'
  | 'settings changed'
  | 'paywall viewed'
  | 'paywall plan selected'
  | 'trial started'
  | 'subscription started'
  | 'subscription renewed'
  | 'subscription canceled'
  | 'subscription billing failed';

interface AnalyticsDebugEvent {
  id: string;
  name: string;
  at: string;
  properties: AnalyticsEventProperties;
}

export interface AnalyticsDebugState {
  initialized: boolean;
  enabled: boolean;
  apiKeyConfigured: boolean;
  host: string;
  mode: 'cloud' | 'local_debug_only';
  flushStatus: 'idle' | 'flushing' | 'error' | 'disabled';
  bufferedEventsEstimate: number;
  lastError?: string;
  distinctId?: string;
  recentEvents: AnalyticsDebugEvent[];
}

interface BuildReminderAnalyticsInput {
  draft: Pick<ReminderDraft, 'category' | 'eventAt' | 'offsetMinutes' | 'recurrence'>;
  entryPoint: ReminderEntryPoint;
  isVoiceFlow: boolean;
  notificationPermissionState?: NotificationPermissionState;
  calendarMode?: CalendarMode;
  parseConfidence?: number;
  parseSource?: string;
  missingFields?: string[];
  confirmationMode?: 'inline' | 'full' | 'auto';
  editedFieldsCount?: number;
  resultReason?: string;
}

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const recentEventLimit = 20;

let analyticsEnabled = false;
let initialized = false;
let hasTrackedAppOpened = false;
let posthogClient: PostHog | null = null;
let debugState: AnalyticsDebugState = {
  initialized: false,
  enabled: false,
  apiKeyConfigured: Boolean(posthogApiKey),
  host: posthogHost,
  mode: posthogApiKey ? 'cloud' : 'local_debug_only',
  flushStatus: 'disabled',
  bufferedEventsEstimate: 0,
  recentEvents: [],
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setDebugState(patch: Partial<AnalyticsDebugState>) {
  debugState = {
    ...debugState,
    ...patch,
  };
  notifyListeners();
}

function getLocaleTag() {
  return getLocales()[0]?.languageTag ?? 'ar-EG';
}

function getAppVersion() {
  return (
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    'dev'
  );
}

function getAppBuild() {
  return (
    Application.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Constants.nativeBuildVersion ??
    'dev'
  );
}

function compactProperties(
  properties: Record<string, AnalyticsPropertyInput>
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ) as AnalyticsEventProperties;
}

function getBaseProperties(): AnalyticsEventProperties {
  return compactProperties({
    app_version: getAppVersion(),
    app_build: getAppBuild(),
    platform: Platform.OS,
    locale: getLocaleTag(),
    build_channel: __DEV__ ? 'dev' : 'release',
  });
}

function pushDebugEvent(name: string, properties: AnalyticsEventProperties) {
  const nextEvent: AnalyticsDebugEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    at: new Date().toISOString(),
    properties,
  };

  setDebugState({
    recentEvents: [nextEvent, ...debugState.recentEvents].slice(0, recentEventLimit),
  });
}

function syncDistinctId() {
  setDebugState({
    distinctId: posthogClient?.getDistinctId(),
  });
}

export function getOffsetBucket(offsetMinutes: number): OffsetBucket {
  if (offsetMinutes <= 0) {
    return 'at_time';
  }

  if (offsetMinutes <= 30) {
    return 'within_30m';
  }

  if (offsetMinutes <= 60) {
    return 'within_60m';
  }

  if (offsetMinutes <= 120) {
    return 'within_120m';
  }

  return 'over_120m';
}

export function getEventTimeBucket(dateLike: string | Date): EventTimeBucket {
  const hour = new Date(dateLike).getHours();
  if (hour < 6) {
    return 'night';
  }

  if (hour < 12) {
    return 'morning';
  }

  if (hour < 18) {
    return 'afternoon';
  }

  return 'evening';
}

export function getParseConfidenceBucket(confidence: number): ParseConfidenceBucket {
  if (confidence >= 0.8) {
    return 'high';
  }

  if (confidence >= 0.6) {
    return 'medium';
  }

  return 'low';
}

export function getCalendarMode({
  settings,
  addToCalendar,
  platform = Platform.OS,
}: {
  settings: Pick<SettingsState, 'appleCalendar' | 'googleCalendar'>;
  addToCalendar?: boolean;
  platform?: string;
}): CalendarMode {
  if (platform === 'ios' && settings.appleCalendar.autoSyncEnabled) {
    return 'apple_auto';
  }

  if (platform === 'android' && settings.googleCalendar.connected) {
    return 'google_connected';
  }

  if (platform === 'android' && addToCalendar) {
    return 'device_manual';
  }

  return 'none';
}

export function buildReminderAnalyticsProperties({
  draft,
  entryPoint,
  isVoiceFlow,
  notificationPermissionState,
  calendarMode = 'none',
  parseConfidence,
  parseSource,
  missingFields = [],
  confirmationMode,
  editedFieldsCount,
  resultReason,
}: BuildReminderAnalyticsInput): AnalyticsEventProperties {
  return compactProperties({
    entry_point: entryPoint,
    is_voice_flow: isVoiceFlow,
    category: draft.category,
    recurrence: draft.recurrence,
    offset_bucket: getOffsetBucket(draft.offsetMinutes),
    event_time_bucket: getEventTimeBucket(draft.eventAt),
    notification_permission_state: notificationPermissionState,
    calendar_mode: calendarMode,
    parse_confidence_bucket:
      parseConfidence === undefined ? undefined : getParseConfidenceBucket(parseConfidence),
    parse_source: parseSource,
    missing_date: missingFields.includes('date'),
    missing_time: missingFields.includes('time'),
    confirmation_mode: confirmationMode,
    edited_fields_count: editedFieldsCount,
    reason: resultReason,
  });
}

export function subscribeAnalyticsDebug(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAnalyticsDebugState() {
  return debugState;
}

function captureInternal(
  name: string,
  properties: Record<string, AnalyticsPropertyInput> = {}
) {
  if (!analyticsEnabled) {
    return;
  }

  const safeProperties = compactProperties({
    ...getBaseProperties(),
    ...properties,
  });

  pushDebugEvent(name, safeProperties);

  if (!posthogClient) {
    return;
  }

  setDebugState({
    bufferedEventsEstimate: debugState.bufferedEventsEstimate + 1,
    flushStatus: 'idle',
    lastError: undefined,
  });
  void posthogClient.capture(name, safeProperties);
}

export async function initAnalytics(defaultEnabled = true) {
  analyticsEnabled = defaultEnabled;
  setDebugState({
    enabled: defaultEnabled,
    initialized: true,
    flushStatus: defaultEnabled ? 'idle' : 'disabled',
  });

  if (initialized) {
    await setAnalyticsEnabled(defaultEnabled);
    return;
  }

  initialized = true;

  if (!posthogApiKey) {
    if (defaultEnabled && !hasTrackedAppOpened) {
      hasTrackedAppOpened = true;
      captureInternal('app opened');
    }
    return;
  }

  try {
    posthogClient = new PostHog(posthogApiKey, {
      host: posthogHost,
      persistence: 'file',
      defaultOptIn: false,
      captureAppLifecycleEvents: true,
      flushAt: 10,
      preloadFeatureFlags: false,
      disableSurveys: true,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: ['error'],
        },
      },
    });
    await posthogClient.ready();
    if (defaultEnabled) {
      await posthogClient.optIn();
    } else {
      await posthogClient.optOut();
    }
    syncDistinctId();
    setDebugState({
      flushStatus: defaultEnabled ? 'idle' : 'disabled',
      lastError: undefined,
    });
    if (defaultEnabled && !hasTrackedAppOpened) {
      hasTrackedAppOpened = true;
      captureInternal('app opened');
    }
  } catch (error) {
    setDebugState({
      mode: 'local_debug_only',
      lastError: error instanceof Error ? error.message : 'analytics_init_failed',
      flushStatus: analyticsEnabled ? 'error' : 'disabled',
    });
  }
}

export function track(
  name: AnalyticsEventName | (string & {}),
  properties: Record<string, AnalyticsPropertyInput> = {}
) {
  captureInternal(name, properties);
}

export function screen(
  name: string,
  properties: Record<string, AnalyticsPropertyInput> = {}
) {
  captureInternal('screen viewed', {
    screen_name: name,
    ...properties,
  });
}

export async function flush() {
  if (!analyticsEnabled || !posthogClient) {
    setDebugState({
      flushStatus: analyticsEnabled ? 'idle' : 'disabled',
      bufferedEventsEstimate: analyticsEnabled ? debugState.bufferedEventsEstimate : 0,
    });
    return;
  }

  setDebugState({
    flushStatus: 'flushing',
    lastError: undefined,
  });

  try {
    await posthogClient.flush();
    setDebugState({
      flushStatus: 'idle',
      bufferedEventsEstimate: 0,
    });
  } catch (error) {
    setDebugState({
      flushStatus: 'error',
      lastError: error instanceof Error ? error.message : 'analytics_flush_failed',
    });
  }
}

export async function setAnalyticsEnabled(enabled: boolean) {
  analyticsEnabled = enabled;

  if (!enabled) {
    if (posthogClient) {
      try {
        await posthogClient.flush();
      } catch {
        // Ignore flush errors while opting out.
      }

      await posthogClient.optOut();
      posthogClient.reset([PostHogPersistedProperty.OptedOut]);
      syncDistinctId();
    }

    setDebugState({
      enabled: false,
      flushStatus: 'disabled',
      bufferedEventsEstimate: 0,
      recentEvents: [],
      lastError: undefined,
    });
    return;
  }

  if (posthogClient) {
    await posthogClient.optIn();
    syncDistinctId();
  }

  setDebugState({
    enabled: true,
    flushStatus: 'idle',
    lastError: undefined,
  });

  if (!hasTrackedAppOpened) {
    hasTrackedAppOpened = true;
    captureInternal('app opened');
  }
}

export async function resetAnalytics() {
  if (posthogClient) {
    posthogClient.reset(
      analyticsEnabled ? undefined : [PostHogPersistedProperty.OptedOut]
    );
    syncDistinctId();
  }

  setDebugState({
    bufferedEventsEstimate: 0,
    recentEvents: [],
    lastError: undefined,
    flushStatus: analyticsEnabled ? 'idle' : 'disabled',
  });
}

export function identifyFutureUser(
  distinctId: string,
  properties: Record<string, AnalyticsPropertyInput> = {}
) {
  if (!analyticsEnabled || !posthogClient) {
    return;
  }

  posthogClient.identify(
    distinctId,
    compactProperties({
      ...getBaseProperties(),
      ...properties,
    })
  );
  syncDistinctId();
}

export function reminderPropertiesFromReminder(
  reminder: Pick<Reminder, 'category' | 'eventAt' | 'offsetMinutes' | 'recurrence'>
) {
  return {
    category: reminder.category,
    recurrence: reminder.recurrence,
    offset_bucket: getOffsetBucket(reminder.offsetMinutes),
    event_time_bucket: getEventTimeBucket(reminder.eventAt),
  };
}
