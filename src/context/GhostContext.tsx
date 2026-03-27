import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Notifications from 'expo-notifications';
import dayjs from 'dayjs';
import { AppState, Platform } from 'react-native';
import {
  FeedbackReason,
  FeedbackSentiment,
  FeedbackTriggerSource,
  NotificationPermissionState,
  PersistedState,
  Reminder,
  ReminderCategory,
  ReminderDraft,
  ReminderMutationResult,
  SettingsState,
  UsageState,
} from '../types';
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
} from '../services/storage';
import {
  cancelReminderNotification,
  cancelReminderNotifications,
  cancelScheduledNotificationsForReminder,
  clearLastNotificationResponse,
  configureNotifications,
  getLastNotificationResponse,
  getNotificationPermissionState,
  getReminderNotificationResponseDetails,
  openSystemSettings,
  requestNotificationPermission,
  REMINDER_NOTIFICATION_ACTION_DONE,
  REMINDER_NOTIFICATION_ACTION_SNOOZE_10M,
  REMINDER_NOTIFICATION_ACTION_SNOOZE_1H,
  scheduleFollowUpReminderNotification,
  scheduleReminderNotification,
  scheduleSnoozedReminderNotification,
  speakReminder,
} from '../services/notifications';
import {
  clearGoogleCalendarCredentials,
  createCalendarEvent,
  GoogleCalendarCredentials,
  saveGoogleCalendarCredentials,
} from '../services/calendar';
import {
  canAutoSyncToAppleCalendar,
  getAppleCalendarAuthorizationStatus,
  requestAppleCalendarWriteAccess,
} from '../services/appleCalendar';
import {
  getCalendarMode,
  initAnalytics,
  reminderPropertiesFromReminder,
  track,
} from '../services/analytics';
import { requestInAppReview } from '../services/review';
import { toDayKey } from '../utils/arabic';
import {
  getReminderBaseNextOccurrence,
  reminderCanScheduleNotification,
  sortRemindersByTimeline,
} from '../utils/reminders';

interface GhostContextValue {
  hydrated: boolean;
  reminders: Reminder[];
  settings: SettingsState;
  usageState: UsageState;
  remainingFreeReminders: number;
  notificationPermission: NotificationPermissionState;
  pendingPermissionReminders: number;
  feedbackPrompt: { source: FeedbackTriggerSource } | null;
  completeOnboarding: () => void;
  acknowledgeAnalyticsNotice: () => void;
  updateSettings: (patch: Partial<SettingsState>) => void;
  setAnalyticsEnabled: (enabled: boolean) => Promise<void>;
  requestNotificationAccess: (source?: string) => Promise<boolean>;
  openNotificationSettings: () => Promise<void>;
  setAppleCalendarAutoSync: (
    enabled: boolean
  ) => Promise<{ enabled: boolean; message?: string }>;
  connectGoogleCalendar: (
    credentials: GoogleCalendarCredentials,
    email?: string
  ) => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  resetAppData: () => Promise<void>;
  createReminder: (
    draft: ReminderDraft,
    originalTranscript: string
  ) => Promise<ReminderMutationResult>;
  updateReminder: (
    id: string,
    draft: ReminderDraft,
    originalTranscript: string
  ) => Promise<ReminderMutationResult>;
  restoreReminder: (snapshot: Reminder, source?: string) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
  completeReminder: (id: string, source?: string) => Promise<void>;
  snoozeReminder: (id: string, minutes: number, source?: string) => Promise<void>;
  openManualFeedback: () => void;
  dismissFeedbackPrompt: () => void;
  respondToFeedbackPrompt: (sentiment: FeedbackSentiment) => void;
  submitFeedback: (input: {
    source: FeedbackTriggerSource;
    reason: FeedbackReason;
    note?: string;
  }) => Promise<void>;
  requestFeedbackReview: (source: FeedbackTriggerSource) => Promise<boolean>;
  trackFeedbackShareSuggested: (source: FeedbackTriggerSource) => void;
}

const defaultUsageState: UsageState = {
  dateKey: toDayKey(),
  createdCount: 0,
  isProMock: true,
  installAt: new Date().toISOString(),
  feedback: {
    totalSuccessfulCreates: 0,
    totalCompletedReminders: 0,
    promptCount: 0,
  },
};

const defaultSettings: SettingsState = {
  uiLanguage: 'ar-EG',
  ttsEnabled: true,
  hasSeenOnboarding: false,
  ghostMode: 'calm',
  followUpEnabled: true,
  followUpDelayMinutes: 20,
  appleCalendar: {
    autoSyncEnabled: false,
    permissionStatus: Platform.OS === 'ios' ? 'not_determined' : 'not_supported',
  },
  googleCalendar: {
    connected: false,
  },
  analytics: {
    enabled: true,
    consentShown: false,
  },
  ads: {
    enabled: false,
    provider: 'none',
    homeBannerEnabled: false,
    interstitialEveryActions: 0,
    hideAdsForFutureSubscribers: true,
  },
};

const GhostContext = createContext<GhostContextValue | null>(null);

function normalizeReminder(
  reminder: Reminder | (Omit<Reminder, 'category'> & { category?: ReminderCategory })
) {
  const hasScheduledIds = Boolean(
    reminder.notificationId ||
      reminder.notificationIds?.length ||
      reminder.snoozedNotificationId ||
      reminder.followUpNotificationId
  );

  return {
    ...reminder,
    category: reminder.category ?? 'other',
    status: reminder.status ?? 'scheduled',
    notificationIds:
      reminder.notificationIds?.length
        ? reminder.notificationIds
        : reminder.notificationId
          ? [reminder.notificationId]
          : undefined,
    notificationStatus:
      reminder.notificationStatus ?? (hasScheduledIds ? 'scheduled' : 'permission_required'),
    followUpCount: reminder.followUpCount ?? 0,
    calendarSyncStatus: reminder.calendarSyncStatus ?? 'none',
  } satisfies Reminder;
}

function normalizeUsageState(usageState: UsageState) {
  const today = toDayKey();
  return {
    ...usageState,
    dateKey: today,
    createdCount: usageState.dateKey === today ? usageState.createdCount : 0,
    isProMock: true,
    installAt: usageState.installAt ?? new Date().toISOString(),
    feedback: {
      totalSuccessfulCreates: usageState.feedback?.totalSuccessfulCreates ?? 0,
      totalCompletedReminders: usageState.feedback?.totalCompletedReminders ?? 0,
      promptCount: usageState.feedback?.promptCount ?? 0,
      lastPromptAt: usageState.feedback?.lastPromptAt,
      lastDismissedAt: usageState.feedback?.lastDismissedAt,
      lastSubmittedAt: usageState.feedback?.lastSubmittedAt,
      lastReviewRequestedAt: usageState.feedback?.lastReviewRequestedAt,
    },
  };
}

function normalizeSettings(
  settings:
    | SettingsState
    | (Partial<SettingsState> & Pick<SettingsState, 'ttsEnabled' | 'hasSeenOnboarding'>)
) {
  return {
    ...defaultSettings,
    ...settings,
    uiLanguage: settings.uiLanguage ?? defaultSettings.uiLanguage,
    ghostMode: defaultSettings.ghostMode,
    followUpEnabled: settings.followUpEnabled ?? defaultSettings.followUpEnabled,
    followUpDelayMinutes:
      settings.followUpDelayMinutes ?? defaultSettings.followUpDelayMinutes,
    appleCalendar: settings.appleCalendar ?? defaultSettings.appleCalendar,
    googleCalendar: settings.googleCalendar ?? defaultSettings.googleCalendar,
    analytics: settings.analytics ?? defaultSettings.analytics,
    ads: settings.ads ?? defaultSettings.ads,
  };
}

function trackNotificationPermissionTransition(
  source: string,
  before: NotificationPermissionState,
  after: NotificationPermissionState
) {
  if (before === 'undetermined') {
    track('notification permission requested', {
      source,
      previous_state: before,
    });
  }

  if (before !== after) {
    track('notification permission changed', {
      source,
      previous_state: before,
      next_state: after,
    });
  }
}

export function GhostProvider({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [usageState, setUsageState] = useState<UsageState>(defaultUsageState);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('undetermined');
  const [feedbackPrompt, setFeedbackPrompt] = useState<{
    source: FeedbackTriggerSource;
  } | null>(null);
  const remindersRef = useRef<Reminder[]>([]);
  const settingsRef = useRef<SettingsState>(defaultSettings);
  const usageStateRef = useRef<UsageState>(defaultUsageState);
  const handledNotificationResponsesRef = useRef<Set<string>>(new Set());
  const notificationLifecycleQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    usageStateRef.current = usageState;
  }, [usageState]);

  function getFeedbackCountBucket(count: number) {
    if (count <= 1) {
      return '1';
    }

    if (count <= 3) {
      return '2_3';
    }

    if (count <= 7) {
      return '4_7';
    }

    return '8_plus';
  }

  function buildFeedbackProperties(source: FeedbackTriggerSource, feedback = usageStateRef.current.feedback) {
    const calendarMode = getCalendarMode({
      settings: settingsRef.current,
    });

    return {
      trigger_source: source,
      reminder_count_bucket: getFeedbackCountBucket(feedback.totalSuccessfulCreates),
      successful_create_count: feedback.totalSuccessfulCreates,
      completed_reminder_count: feedback.totalCompletedReminders,
      language: settingsRef.current.uiLanguage,
      calendar_mode: calendarMode,
      calendar_enabled: calendarMode !== 'none',
    };
  }

  function canShowFeedbackPrompt(source: Exclude<FeedbackTriggerSource, 'settings_manual'>, feedback = usageStateRef.current.feedback) {
    if (feedbackPrompt) {
      return false;
    }

    const now = dayjs();

    if (feedback.lastReviewRequestedAt && now.diff(dayjs(feedback.lastReviewRequestedAt), 'day') < 60) {
      return false;
    }

    if (feedback.lastPromptAt && now.diff(dayjs(feedback.lastPromptAt), 'day') < 14) {
      return false;
    }

    if (source === 'save_success') {
      return feedback.totalSuccessfulCreates >= 3;
    }

    return feedback.totalCompletedReminders >= 1;
  }

  function showFeedbackPrompt(source: FeedbackTriggerSource, feedbackOverride?: UsageState['feedback']) {
    const feedback = feedbackOverride ?? usageStateRef.current.feedback;

    if (source !== 'settings_manual' && !canShowFeedbackPrompt(source, feedback)) {
      return;
    }

    if (source === 'settings_manual') {
      track('feedback prompt shown', buildFeedbackProperties(source, feedback));
      setFeedbackPrompt({ source });
      return;
    }

    const shownAt = new Date().toISOString();
    const nextUsage = normalizeUsageState({
      ...usageStateRef.current,
      feedback: {
        ...feedback,
        promptCount: feedback.promptCount + 1,
        lastPromptAt: shownAt,
      },
    });

    usageStateRef.current = nextUsage;
    setUsageState(nextUsage);
    track('feedback prompt shown', buildFeedbackProperties(source, nextUsage.feedback));
    setFeedbackPrompt({ source });
  }

  async function refreshNotificationPermission() {
    const nextPermission = await getNotificationPermissionState();
    setNotificationPermission((current) =>
      current === nextPermission ? current : nextPermission
    );
    return nextPermission;
  }

  async function refreshAppleCalendarPermission() {
    const nextStatus = await getAppleCalendarAuthorizationStatus();
    setSettings((current) => {
      const nextAutoSync = canAutoSyncToAppleCalendar(nextStatus)
        ? current.appleCalendar.autoSyncEnabled
        : false;

      if (
        current.appleCalendar.permissionStatus === nextStatus &&
        current.appleCalendar.autoSyncEnabled === nextAutoSync
      ) {
        return current;
      }

      return normalizeSettings({
        ...current,
        appleCalendar: {
          autoSyncEnabled: nextAutoSync,
          permissionStatus: nextStatus,
        },
      });
    });

    return nextStatus;
  }

  function withNotificationLifecycleLock<T>(task: () => Promise<T>) {
    const taskPromise = notificationLifecycleQueueRef.current.then(task, task);
    notificationLifecycleQueueRef.current = taskPromise.then(
      () => undefined,
      () => undefined
    );
    return taskPromise;
  }

  async function cancelAllReminderNotifications(reminder: Reminder) {
    await Promise.all([
      cancelReminderNotifications(reminder.notificationIds),
      cancelReminderNotification(reminder.notificationId),
      cancelReminderNotification(reminder.snoozedNotificationId),
      cancelReminderNotification(reminder.followUpNotificationId),
      cancelScheduledNotificationsForReminder(reminder.id),
    ]);
  }

  async function scheduleReminderLifecycle(
    reminder: Reminder,
    permissionOverride?: NotificationPermissionState
  ) {
    return withNotificationLifecycleLock(async () => {
      const now = dayjs();
      const needsBaseNotification =
        reminder.recurrence !== 'none' ||
        (!reminder.snoozedUntil &&
          reminder.recurrence === 'none' &&
          reminder.status !== 'done' &&
          !reminder.completedAt &&
          dayjs(reminder.remindAt).isAfter(now.add(1, 'minute')));
      const needsSnoozedNotification = Boolean(
        reminder.snoozedUntil && dayjs(reminder.snoozedUntil).isAfter(now.add(1, 'minute'))
      );
      const requiresNotification = needsBaseNotification || needsSnoozedNotification;

      await cancelAllReminderNotifications(reminder);

      const permission =
        permissionOverride ??
        (requiresNotification ? await requestNotificationPermission() : null);

      let nextReminder: Reminder = {
        ...reminder,
        notificationId: undefined,
        notificationIds: undefined,
        snoozedNotificationId: undefined,
        followUpNotificationId: undefined,
        followUpForAt: undefined,
        followUpCount: 0,
        notificationStatus:
          permission === 'granted'
            ? 'scheduled'
            : requiresNotification
              ? 'permission_required'
              : reminder.notificationStatus,
      };

      if (permission !== 'granted') {
        return nextReminder;
      }

      let scheduledAnything = false;

      if (needsBaseNotification) {
        const scheduledBase = await scheduleReminderNotification(
          nextReminder,
          settingsRef.current.uiLanguage
        );
        nextReminder = {
          ...nextReminder,
          notificationId: scheduledBase.notificationId,
          notificationIds: scheduledBase.notificationIds,
          notificationStatus: scheduledBase.status,
        };
        scheduledAnything =
          scheduledBase.status === 'scheduled' &&
          Boolean(
            scheduledBase.notificationId || scheduledBase.notificationIds?.length
          );
      }

      if (needsSnoozedNotification && nextReminder.snoozedUntil) {
        nextReminder = {
          ...nextReminder,
          snoozedNotificationId: await scheduleSnoozedReminderNotification(
            nextReminder,
            nextReminder.snoozedUntil,
            settingsRef.current.uiLanguage
          ),
          notificationStatus: 'scheduled',
        };
        scheduledAnything = true;
      }

      if (
        settingsRef.current.followUpEnabled &&
        !nextReminder.snoozedUntil &&
        needsBaseNotification
      ) {
        const nextOccurrence = getReminderBaseNextOccurrence(nextReminder, now);
        if (nextOccurrence) {
          const followUpAt = nextOccurrence
            .add(settingsRef.current.followUpDelayMinutes, 'minute')
            .second(0)
            .millisecond(0);

          if (followUpAt.isAfter(now.add(1, 'minute'))) {
            nextReminder = {
              ...nextReminder,
              followUpNotificationId: await scheduleFollowUpReminderNotification(
                nextReminder,
                followUpAt.toISOString(),
                settingsRef.current.uiLanguage
              ),
              followUpForAt: nextOccurrence.toISOString(),
              followUpCount: 1,
              notificationStatus: 'scheduled',
            };
            scheduledAnything = true;
          }
        }
      }

      if (!scheduledAnything && !requiresNotification) {
        nextReminder = {
          ...nextReminder,
          notificationStatus: reminder.notificationStatus,
        };
      }

      return nextReminder;
    });
  }

  function maybeTrackNotificationScheduled(
    source: string,
    reminder: Reminder,
    previousReminder?: Reminder
  ) {
    const nextHasBaseIds = Boolean(
      reminder.notificationId || reminder.notificationIds?.length
    );
    const previousHasBaseIds = previousReminder
      ? Boolean(previousReminder.notificationId || previousReminder.notificationIds?.length)
      : false;

    if (!nextHasBaseIds || (source === 'permission_resync' && previousHasBaseIds)) {
      return;
    }

    track('notification scheduled', {
      source,
      notification_status: reminder.notificationStatus,
      notification_permission_state: reminder.notificationStatus === 'scheduled' ? 'granted' : undefined,
      ...reminderPropertiesFromReminder(reminder),
    });
  }

  async function syncReminderNotifications(
    permissionOverride?: NotificationPermissionState
  ) {
    const permission = permissionOverride ?? (await refreshNotificationPermission());

    const nextReminders = await Promise.all(
      remindersRef.current.map(async (reminder) => {
        const nextReminder = await scheduleReminderLifecycle(reminder, permission);
        maybeTrackNotificationScheduled('permission_resync', nextReminder, reminder);
        return nextReminder;
      })
    );

    setReminders(nextReminders);
    return permission === 'granted';
  }

  async function completeReminderInternal(id: string, source = 'list') {
    const existing = remindersRef.current.find((item) => item.id === id);
    if (!existing) {
      return;
    }

    const nowIso = new Date().toISOString();
    const permission = await getNotificationPermissionState();
    const nextReminder = await scheduleReminderLifecycle(
      {
        ...existing,
        status: existing.recurrence === 'none' ? 'done' : 'scheduled',
        completedAt: nowIso,
        snoozedUntil: undefined,
        snoozedNotificationId: undefined,
        followUpNotificationId: undefined,
        followUpForAt: undefined,
        followUpCount: 0,
        lastTriggeredAt: nowIso,
      },
      permission
    );

    setReminders((current) =>
      current.map((item) => (item.id === id ? nextReminder : item))
    );

    track('reminder completed', {
      source,
      notification_permission_state: nextReminder.notificationStatus,
      is_recurring: existing.recurrence !== 'none',
      ...reminderPropertiesFromReminder(nextReminder),
    });

    const nextUsage = normalizeUsageState({
      ...usageStateRef.current,
      feedback: {
        ...usageStateRef.current.feedback,
        totalCompletedReminders: usageStateRef.current.feedback.totalCompletedReminders + 1,
      },
    });

    usageStateRef.current = nextUsage;
    setUsageState(nextUsage);
    showFeedbackPrompt('reminder_completed', nextUsage.feedback);
  }

  async function snoozeReminderInternal(
    id: string,
    minutes: number,
    source = 'list'
  ) {
    const existing = remindersRef.current.find((item) => item.id === id);
    if (!existing) {
      return;
    }

    const now = dayjs();
    const snoozedUntil = now.add(minutes, 'minute').second(0).millisecond(0).toISOString();
    const permission = await getNotificationPermissionState();
    const nextReminder = await scheduleReminderLifecycle(
      {
        ...existing,
        status: 'scheduled',
        completedAt: undefined,
        snoozedUntil,
        lastTriggeredAt: now.toISOString(),
        followUpNotificationId: undefined,
        followUpForAt: undefined,
        followUpCount: 0,
      },
      permission
    );

    setReminders((current) =>
      current.map((item) => (item.id === id ? nextReminder : item))
    );

    track('reminder snoozed', {
      source,
      snooze_minutes: minutes,
      notification_permission_state: nextReminder.notificationStatus,
      ...reminderPropertiesFromReminder(nextReminder),
    });
  }

  async function restoreReminderInternal(snapshot: Reminder, source = 'undo') {
    const existing = remindersRef.current.find((item) => item.id === snapshot.id);
    if (existing) {
      await withNotificationLifecycleLock(() => cancelAllReminderNotifications(existing));
    }

    const permission = await getNotificationPermissionState();
    const nextReminder = await scheduleReminderLifecycle(
      {
        ...snapshot,
        completedAt: snapshot.completedAt,
        snoozedUntil: snapshot.snoozedUntil,
        lastTriggeredAt: snapshot.lastTriggeredAt,
        followUpCount: snapshot.followUpCount,
      },
      permission
    );

    setReminders((current) => {
      if (current.some((item) => item.id === snapshot.id)) {
        return current.map((item) => (item.id === snapshot.id ? nextReminder : item));
      }

      return [...current, nextReminder];
    });

    track('reminder reopened', {
      source,
      notification_permission_state: nextReminder.notificationStatus,
      ...reminderPropertiesFromReminder(nextReminder),
    });
  }

  async function handleNotificationResponse(
    response: Notifications.NotificationResponse,
    shouldClearLastResponse = false
  ) {
    const details = getReminderNotificationResponseDetails(response);
    if (!details) {
      if (shouldClearLastResponse) {
        await clearLastNotificationResponse();
      }
      return;
    }

    const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledNotificationResponsesRef.current.has(responseKey)) {
      if (shouldClearLastResponse) {
        await clearLastNotificationResponse();
      }
      return;
    }

    handledNotificationResponsesRef.current.add(responseKey);
    const existing = remindersRef.current.find((item) => item.id === details.reminderId);
    if (!existing) {
      if (shouldClearLastResponse) {
        await clearLastNotificationResponse();
      }
      return;
    }

    setReminders((current) =>
      current.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              lastTriggeredAt: new Date().toISOString(),
            }
          : item
      )
    );

    if (response.actionIdentifier === REMINDER_NOTIFICATION_ACTION_DONE) {
      await completeReminderInternal(details.reminderId, 'notification');
    } else if (response.actionIdentifier === REMINDER_NOTIFICATION_ACTION_SNOOZE_10M) {
      await snoozeReminderInternal(details.reminderId, 10, 'notification');
    } else if (response.actionIdentifier === REMINDER_NOTIFICATION_ACTION_SNOOZE_1H) {
      await snoozeReminderInternal(details.reminderId, 60, 'notification');
    } else if (settingsRef.current.ttsEnabled) {
      speakReminder(existing.title, settingsRef.current.uiLanguage);
    }

    if (shouldClearLastResponse) {
      await clearLastNotificationResponse();
    }
  }

  useEffect(() => {
    const hydrate = async () => {
      const persisted = await loadPersistedState();
      if (persisted) {
        setReminders(persisted.reminders.map((reminder) => normalizeReminder(reminder)));
        setSettings(normalizeSettings(persisted.settings));
        setUsageState(normalizeUsageState(persisted.usageState));
      }
      setHydrated(true);
    };

    void hydrate();
  }, []);

  useEffect(() => {
    void refreshNotificationPermission();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void initAnalytics(settings.analytics.enabled);
  }, [hydrated, settings.analytics.enabled]);

  useEffect(() => {
    void configureNotifications(settings.uiLanguage);
  }, [settings.uiLanguage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void refreshAppleCalendarPermission();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const state: PersistedState = {
      reminders,
      settings,
      usageState: normalizeUsageState(usageState),
    };

    void savePersistedState(state);
  }, [hydrated, reminders, settings, usageState]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void refreshNotificationPermission().then((permission) => {
      void syncReminderNotifications(permission);
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || notificationPermission !== 'granted') {
      return;
    }

    void syncReminderNotifications('granted');
  }, [
    hydrated,
    notificationPermission,
    settings.followUpEnabled,
    settings.followUpDelayMinutes,
    settings.uiLanguage,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void refreshNotificationPermission().then((permission) => {
        void syncReminderNotifications(permission);
      });
      void refreshAppleCalendarPermission();
      void getLastNotificationResponse().then((response) => {
        if (response) {
          void handleNotificationResponse(response, true);
        }
      });
    });

    return () => {
      subscription.remove();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void getLastNotificationResponse().then((response) => {
      if (response) {
        void handleNotificationResponse(response, true);
      }
    });
  }, [hydrated]);

  useEffect(() => {
    const receiveSub = Notifications.addNotificationReceivedListener((event) => {
      const reminderId = String(event.request.content.data?.reminderId ?? '');
      if (!reminderId) {
        return;
      }

      setReminders((current) =>
        current.map((item) =>
          item.id === reminderId
            ? {
                ...item,
                lastTriggeredAt: new Date().toISOString(),
              }
            : item
        )
      );

      if (!settingsRef.current.ttsEnabled) {
        return;
      }

      const reminder = remindersRef.current.find((item) => item.id === reminderId);
      if (reminder) {
        speakReminder(reminder.title, settingsRef.current.uiLanguage);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    return () => {
      receiveSub.remove();
      responseSub.remove();
    };
  }, [hydrated]);

  const remainingFreeReminders = Number.POSITIVE_INFINITY;
  const pendingPermissionReminders = reminders.filter(
    (reminder) =>
      reminder.notificationStatus === 'permission_required' &&
      reminderCanScheduleNotification(reminder)
  ).length;

  const value = useMemo<GhostContextValue>(
    () => ({
      hydrated,
      reminders: sortRemindersByTimeline(reminders),
      settings,
      usageState: normalizeUsageState(usageState),
      remainingFreeReminders,
      notificationPermission,
      pendingPermissionReminders,
      feedbackPrompt,
      completeOnboarding: () => {
        track('onboarding completed');
        setSettings((current) => ({ ...current, hasSeenOnboarding: true }));
      },
      acknowledgeAnalyticsNotice: () => {
        setSettings((current) =>
          current.analytics.consentShown
            ? current
            : normalizeSettings({
                ...current,
                analytics: {
                  ...current.analytics,
                  consentShown: true,
                },
              })
        );
      },
      updateSettings: (patch) => {
        track('settings changed', {
          setting_keys: Object.keys(patch).join(','),
          ui_language: patch.uiLanguage,
          ghost_mode: patch.ghostMode,
          tts_enabled: patch.ttsEnabled,
          follow_up_enabled: patch.followUpEnabled,
          follow_up_delay_minutes: patch.followUpDelayMinutes,
          ads_enabled: patch.ads?.enabled,
          ads_provider: patch.ads?.provider,
        });
        setSettings((current) => normalizeSettings({ ...current, ...patch }));
      },
      setAnalyticsEnabled: async (enabled) => {
        setSettings((current) =>
          normalizeSettings({
            ...current,
            analytics: {
              enabled,
              consentShown: true,
            },
          })
        );
      },
      requestNotificationAccess: async (source = 'settings') => {
        const before = notificationPermission;
        const permission = await requestNotificationPermission();
        setNotificationPermission(permission);
        trackNotificationPermissionTransition(source, before, permission);
        if (permission === 'granted') {
          await syncReminderNotifications(permission);
          return true;
        }

        return false;
      },
      openNotificationSettings: async () => {
        await openSystemSettings();
      },
      openManualFeedback: () => {
        showFeedbackPrompt('settings_manual');
      },
      dismissFeedbackPrompt: () => {
        const currentPrompt = feedbackPrompt;
        setFeedbackPrompt(null);

        if (!currentPrompt || currentPrompt.source === 'settings_manual') {
          return;
        }

        const nextUsage = normalizeUsageState({
          ...usageStateRef.current,
          feedback: {
            ...usageStateRef.current.feedback,
            lastDismissedAt: new Date().toISOString(),
          },
        });
        usageStateRef.current = nextUsage;
        setUsageState(nextUsage);
      },
      respondToFeedbackPrompt: (sentiment) => {
        if (!feedbackPrompt) {
          return;
        }

        track('feedback prompt answered', {
          sentiment,
          ...buildFeedbackProperties(feedbackPrompt.source),
        });
        track('feedback sentiment selected', {
          sentiment,
          ...buildFeedbackProperties(feedbackPrompt.source),
        });
      },
      submitFeedback: async ({ source, reason, note }) => {
        track('feedback submitted', {
          feedback_reason: reason,
          has_note: Boolean(note?.trim()),
          note_length: note?.trim().length,
          ...buildFeedbackProperties(source),
        });

        const nextUsage = normalizeUsageState({
          ...usageStateRef.current,
          feedback: {
            ...usageStateRef.current.feedback,
            lastSubmittedAt: new Date().toISOString(),
          },
        });
        usageStateRef.current = nextUsage;
        setUsageState(nextUsage);
        setFeedbackPrompt(null);
      },
      requestFeedbackReview: async (source) => {
        const requested = await requestInAppReview();

        track('app review requested', {
          review_available: requested,
          ...buildFeedbackProperties(source),
        });

        if (requested) {
          const nextUsage = normalizeUsageState({
            ...usageStateRef.current,
            feedback: {
              ...usageStateRef.current.feedback,
              lastReviewRequestedAt: new Date().toISOString(),
            },
          });
          usageStateRef.current = nextUsage;
          setUsageState(nextUsage);
        }

        setFeedbackPrompt(null);
        return requested;
      },
      trackFeedbackShareSuggested: (source) => {
        track('share suggested', buildFeedbackProperties(source));
        setFeedbackPrompt(null);
      },
      setAppleCalendarAutoSync: async (enabled) => {
        if (Platform.OS !== 'ios') {
          setSettings((current) =>
            normalizeSettings({
              ...current,
              appleCalendar: {
                autoSyncEnabled: false,
                permissionStatus: 'not_supported',
              },
            })
          );
          return {
            enabled: false,
            message:
              settings.uiLanguage === 'en'
                ? 'Apple Calendar is available on iPhone only.'
                : 'Apple Calendar متاح على iPhone فقط.',
          };
        }

        if (!enabled) {
          const status = await getAppleCalendarAuthorizationStatus();
          setSettings((current) =>
            normalizeSettings({
              ...current,
              appleCalendar: {
                autoSyncEnabled: false,
                permissionStatus: status,
              },
            })
          );
          track('apple calendar auto-sync toggled', {
            requested_enabled: false,
            enabled: false,
            permission_status: status,
          });
          return {
            enabled: false,
          };
        }

        const currentStatus = await getAppleCalendarAuthorizationStatus();
        if (canAutoSyncToAppleCalendar(currentStatus)) {
          setSettings((current) =>
            normalizeSettings({
              ...current,
              appleCalendar: {
                autoSyncEnabled: true,
                permissionStatus: currentStatus,
              },
            })
          );
          track('apple calendar auto-sync toggled', {
            requested_enabled: true,
            enabled: true,
            permission_status: currentStatus,
          });
          return {
            enabled: true,
          };
        }

        const accessResult = await requestAppleCalendarWriteAccess();
        const nextEnabled =
          accessResult.granted && canAutoSyncToAppleCalendar(accessResult.status);
        setSettings((current) =>
          normalizeSettings({
            ...current,
            appleCalendar: {
              autoSyncEnabled: nextEnabled,
              permissionStatus: accessResult.status,
            },
          })
        );
        track('apple calendar auto-sync toggled', {
          requested_enabled: true,
          enabled: nextEnabled,
          permission_status: accessResult.status,
        });

        if (nextEnabled) {
          return {
            enabled: true,
          };
        }

        const message =
          accessResult.status === 'restricted'
            ? settings.uiLanguage === 'en'
              ? 'Calendar access is restricted on this device.'
              : 'الوصول إلى التقويم مقيّد على هذا الجهاز.'
            : accessResult.status === 'denied'
              ? settings.uiLanguage === 'en'
                ? 'Calendar access is disabled. Allow it in system settings if you want sync.'
                : 'تم إيقاف الوصول إلى التقويم. اسمح به من إعدادات النظام إذا أردت المزامنة.'
              : settings.uiLanguage === 'en'
                ? 'We could not enable Apple Calendar sync right now.'
                : 'لم نتمكن من تفعيل مزامنة Apple Calendar الآن.';

        return {
          enabled: false,
          message,
        };
      },
      connectGoogleCalendar: async (credentials, email) => {
        await saveGoogleCalendarCredentials(credentials);
        setSettings((current) =>
          normalizeSettings({
            ...current,
            googleCalendar: {
              connected: true,
              email,
            },
          })
        );
        track('google calendar connected', {
          has_email: Boolean(email),
        });
      },
      disconnectGoogleCalendar: async () => {
        await clearGoogleCalendarCredentials();
        setSettings((current) =>
          normalizeSettings({
            ...current,
            googleCalendar: {
              connected: false,
            },
          })
        );
        track('google calendar disconnected');
      },
      resetAppData: async () => {
        await withNotificationLifecycleLock(() =>
          Promise.all(
            remindersRef.current.map((reminder) => cancelAllReminderNotifications(reminder))
          )
        );
        await clearGoogleCalendarCredentials();
        setReminders([]);
        setSettings(defaultSettings);
        setUsageState(defaultUsageState);
        usageStateRef.current = defaultUsageState;
        setFeedbackPrompt(null);
        await clearPersistedState();
      },
      createReminder: async (draft, originalTranscript) => {
        const normalizedUsage = normalizeUsageState(usageStateRef.current);
        const title = draft.title.trim();

        if (!title) {
          return {
            ok: false,
            reason:
              settings.uiLanguage === 'en'
                ? 'The task name needs to be clear.'
                : 'لازم اسم المهمة يبقى واضح.',
          };
        }

        const eventAt = dayjs(draft.eventAt).second(0).millisecond(0).toISOString();
        const remindAt = dayjs(eventAt)
          .subtract(draft.offsetMinutes, 'minute')
          .toISOString();

        if (
          draft.recurrence === 'none' &&
          dayjs(remindAt).isBefore(dayjs().add(1, 'minute'))
        ) {
          return {
            ok: false,
            reason:
              settings.uiLanguage === 'en'
                ? 'The reminder time must still be in the future.'
                : 'وقت التذكير لازم يكون قدام شوية.',
          };
        }

        const shouldSyncCalendar =
          Platform.OS === 'ios'
            ? settings.appleCalendar.autoSyncEnabled
            : Boolean(draft.addToCalendar);
        const calendarMode = getCalendarMode({
          settings,
          addToCalendar: draft.addToCalendar,
        });

        let reminder: Reminder = {
          id: `${Date.now()}`,
          title,
          category: draft.category,
          originalTranscript,
          eventAt,
          remindAt,
          offsetMinutes: draft.offsetMinutes,
          recurrence: draft.recurrence,
          status: 'scheduled',
          createdAt: new Date().toISOString(),
          notificationStatus: 'permission_required',
          followUpCount: 0,
          calendarSyncStatus: shouldSyncCalendar ? 'pending' : 'none',
        };

        const notificationBefore = await getNotificationPermissionState();
        reminder = await scheduleReminderLifecycle(reminder);
        const notificationAfter =
          reminder.notificationStatus === 'scheduled'
            ? 'granted'
            : await getNotificationPermissionState();
        trackNotificationPermissionTransition(
          'reminder_create',
          notificationBefore,
          notificationAfter
        );
        maybeTrackNotificationScheduled('reminder_create', reminder);

        setReminders((current) => [reminder, ...current]);
        const nextUsage = normalizeUsageState({
          ...normalizedUsage,
          createdCount: normalizedUsage.createdCount + 1,
          firstReminderCreatedAt:
            normalizedUsage.firstReminderCreatedAt ?? reminder.createdAt,
          firstVoiceReminderCreatedAt:
            originalTranscript.trim()
              ? normalizedUsage.firstVoiceReminderCreatedAt ?? reminder.createdAt
              : normalizedUsage.firstVoiceReminderCreatedAt,
          feedback: {
            ...normalizedUsage.feedback,
            totalSuccessfulCreates: normalizedUsage.feedback.totalSuccessfulCreates + 1,
          },
        });
        usageStateRef.current = nextUsage;
        setUsageState(nextUsage);

        if (shouldSyncCalendar) {
          track('calendar sync attempted', {
            source: 'reminder_create',
            calendar_mode: calendarMode,
            calendar_alert_offset_minutes: draft.offsetMinutes,
            calendar_alert_timing:
              draft.offsetMinutes === 0 ? 'same_time' : 'before_event',
            ...reminderPropertiesFromReminder(reminder),
          });
          void createCalendarEvent({
            title,
            date: eventAt,
            reminderOffset: draft.offsetMinutes,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            googleCalendar: settings.googleCalendar,
          })
            .then((calendarResult) => {
              if (calendarResult.status === 'synced' || calendarResult.status === 'failed') {
                track(
                  calendarResult.status === 'synced'
                    ? 'calendar sync succeeded'
                    : 'calendar sync failed',
                  {
                    source: 'reminder_create',
                    calendar_mode: calendarMode,
                    calendar_provider: calendarResult.provider,
                    calendar_status: calendarResult.status,
                    calendar_alert_configured: Boolean(calendarResult.alertConfigured),
                    calendar_alert_offset_minutes: draft.offsetMinutes,
                    calendar_alert_timing:
                      draft.offsetMinutes === 0 ? 'same_time' : 'before_event',
                    ...reminderPropertiesFromReminder(reminder),
                  }
                );
              }
              setReminders((current) =>
                current.map((item) =>
                  item.id === reminder.id
                    ? {
                        ...item,
                        calendarSyncStatus: calendarResult.status,
                        calendarProvider: calendarResult.provider,
                        calendarEventId: calendarResult.eventId,
                      }
                    : item
                )
              );
            })
            .catch((error) => {
              track('calendar sync failed', {
                source: 'reminder_create',
                calendar_mode: calendarMode,
                calendar_alert_offset_minutes: draft.offsetMinutes,
                calendar_alert_timing:
                  draft.offsetMinutes === 0 ? 'same_time' : 'before_event',
                ...reminderPropertiesFromReminder(reminder),
              });
              if (__DEV__) {
                console.warn('Calendar sync failed', error);
              }
            });
        }

        const result =
          reminder.notificationStatus === 'permission_required' &&
          reminderCanScheduleNotification(reminder)
            ? {
                ok: true,
                reminderId: reminder.id,
                warning:
                  settings.uiLanguage === 'en'
                    ? 'The reminder was saved, but you need to enable notifications so it arrives on time.'
                    : 'التذكير اتحفظ، لكن لازم تفعّل الإشعارات علشان يوصلك في وقته.',
              }
            : { ok: true, reminderId: reminder.id };

        if (!result.warning) {
          showFeedbackPrompt('save_success', nextUsage.feedback);
        }

        return result;
      },
      updateReminder: async (id, draft, originalTranscript) => {
        const existing = remindersRef.current.find((item) => item.id === id);
        if (!existing) {
          return {
            ok: false,
            reason:
              settings.uiLanguage === 'en'
                ? 'This reminder no longer exists.'
                : 'التذكير ده مش موجود.',
          };
        }

        const title = draft.title.trim();
        if (!title) {
          return {
            ok: false,
            reason:
              settings.uiLanguage === 'en'
                ? 'The task name needs to be clear.'
                : 'لازم اسم المهمة يبقى واضح.',
          };
        }

        const eventAt = dayjs(draft.eventAt).second(0).millisecond(0).toISOString();
        const remindAt = dayjs(eventAt)
          .subtract(draft.offsetMinutes, 'minute')
          .toISOString();

        if (
          draft.recurrence === 'none' &&
          dayjs(remindAt).isBefore(dayjs().add(1, 'minute'))
        ) {
          return {
            ok: false,
            reason:
              settings.uiLanguage === 'en'
                ? 'The reminder time must still be in the future.'
                : 'وقت التذكير لازم يكون قدام شوية.',
          };
        }

        const reopened = Boolean(
          existing.completedAt || existing.snoozedUntil || existing.status === 'done'
        );

        const notificationBefore = await getNotificationPermissionState();
        const nextReminder = await scheduleReminderLifecycle({
          ...existing,
          title,
          category: draft.category,
          originalTranscript: originalTranscript.trim() || existing.originalTranscript,
          eventAt,
          remindAt,
          offsetMinutes: draft.offsetMinutes,
          recurrence: draft.recurrence,
          status: 'scheduled',
          completedAt: undefined,
          snoozedUntil: undefined,
          snoozedNotificationId: undefined,
          followUpNotificationId: undefined,
          followUpForAt: undefined,
          followUpCount: 0,
        });
        const notificationAfter =
          nextReminder.notificationStatus === 'scheduled'
            ? 'granted'
            : await getNotificationPermissionState();
        trackNotificationPermissionTransition(
          'reminder_update',
          notificationBefore,
          notificationAfter
        );
        maybeTrackNotificationScheduled('reminder_update', nextReminder, existing);

        if (reopened) {
          track('reminder reopened', {
            source: 'edit',
            notification_permission_state: nextReminder.notificationStatus,
            ...reminderPropertiesFromReminder(nextReminder),
          });
        }

        setReminders((current) =>
          current.map((item) => (item.id === id ? nextReminder : item))
        );

        return nextReminder.notificationStatus === 'permission_required' &&
          reminderCanScheduleNotification(nextReminder)
          ? {
              ok: true,
              warning:
                settings.uiLanguage === 'en'
                  ? 'Changes were saved, but notifications are still disabled for this reminder.'
                  : 'التعديل اتحفظ، لكن الإشعارات ما زالت غير مفعّلة لهذا التذكير.',
            }
          : { ok: true };
      },
      removeReminder: async (id) => {
        const target = remindersRef.current.find((item) => item.id === id);
        if (!target) {
          return;
        }

        await withNotificationLifecycleLock(() => cancelAllReminderNotifications(target));
        track('reminder deleted', {
          entry_point: 'edit',
          notification_permission_state: target.notificationStatus,
          ...reminderPropertiesFromReminder(target),
        });
        setReminders((current) => current.filter((item) => item.id !== id));
      },
      restoreReminder: async (snapshot, source = 'undo') => {
        await restoreReminderInternal(snapshot, source);
      },
      completeReminder: async (id, source = 'list') => {
        await completeReminderInternal(id, source);
      },
      snoozeReminder: async (id, minutes, source = 'list') => {
        await snoozeReminderInternal(id, minutes, source);
      },
    }),
    [
      hydrated,
      reminders,
      settings,
      usageState,
      remainingFreeReminders,
      notificationPermission,
      pendingPermissionReminders,
      feedbackPrompt,
    ]
  );

  return <GhostContext.Provider value={value}>{children}</GhostContext.Provider>;
}

export function useGhost() {
  const context = useContext(GhostContext);
  if (!context) {
    throw new Error('useGhost must be used inside GhostProvider');
  }

  return context;
}
