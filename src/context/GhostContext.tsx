import {
  createContext,
  PropsWithChildren,
  useRef,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Notifications from 'expo-notifications';
import dayjs from 'dayjs';
import { AppState, Platform } from 'react-native';
import {
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
  getNotificationPermissionState,
  openSystemSettings,
  requestNotificationPermission,
  scheduleReminderNotification,
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
import { toDayKey } from '../utils/arabic';
import { reminderCanScheduleNotification } from '../utils/reminders';

interface GhostContextValue {
  hydrated: boolean;
  reminders: Reminder[];
  settings: SettingsState;
  usageState: UsageState;
  remainingFreeReminders: number;
  notificationPermission: NotificationPermissionState;
  pendingPermissionReminders: number;
  completeOnboarding: () => void;
  updateSettings: (patch: Partial<SettingsState>) => void;
  requestNotificationAccess: () => Promise<boolean>;
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
  removeReminder: (id: string) => Promise<void>;
}

const defaultUsageState: UsageState = {
  dateKey: toDayKey(),
  createdCount: 0,
  isProMock: true,
};

const defaultSettings: SettingsState = {
  ttsEnabled: true,
  hasSeenOnboarding: false,
  ghostMode: 'sassy',
  appleCalendar: {
    autoSyncEnabled: false,
    permissionStatus: Platform.OS === 'ios' ? 'not_determined' : 'not_supported',
  },
  googleCalendar: {
    connected: false,
  },
};

const GhostContext = createContext<GhostContextValue | null>(null);

function normalizeReminder(reminder: Reminder | (Omit<Reminder, 'category'> & { category?: ReminderCategory })) {
  return {
    ...reminder,
    category: reminder.category ?? 'other',
    notificationStatus:
      reminder.notificationStatus ?? (reminder.notificationId ? 'scheduled' : 'permission_required'),
    calendarSyncStatus: reminder.calendarSyncStatus ?? 'none',
  };
}

function normalizeUsageState(usageState: UsageState) {
  const today = toDayKey();
  return {
    ...usageState,
    dateKey: today,
    createdCount: usageState.dateKey === today ? usageState.createdCount : 0,
    isProMock: true,
  };
}

function normalizeSettings(settings: SettingsState | (Partial<SettingsState> & Pick<SettingsState, 'ttsEnabled' | 'hasSeenOnboarding'>)) {
  return {
    ...defaultSettings,
    ...settings,
    ghostMode: settings.ghostMode ?? defaultSettings.ghostMode,
    appleCalendar: settings.appleCalendar ?? defaultSettings.appleCalendar,
    googleCalendar: settings.googleCalendar ?? defaultSettings.googleCalendar,
  };
}

export function GhostProvider({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [usageState, setUsageState] = useState<UsageState>(defaultUsageState);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('undetermined');
  const remindersRef = useRef<Reminder[]>([]);

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

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
      const currentPermission = current.appleCalendar.permissionStatus;
      const currentAutoSync = current.appleCalendar.autoSyncEnabled;

      if (currentPermission === nextStatus && currentAutoSync === nextAutoSync) {
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

  async function syncReminderNotifications(
    permissionOverride?: NotificationPermissionState
  ) {
    const permission = permissionOverride ?? (await refreshNotificationPermission());
    if (permission !== 'granted') {
      setReminders((current) =>
        current.map((reminder) =>
          reminder.notificationId || !reminderCanScheduleNotification(reminder)
            ? reminder
            : {
                ...reminder,
                notificationStatus: 'permission_required',
              }
        )
      );
      return false;
    }

    const currentReminders = remindersRef.current;
    const nextReminders = await Promise.all(
      currentReminders.map(async (reminder) => {
        if (!reminderCanScheduleNotification(reminder)) {
          return reminder;
        }

        if (reminder.notificationStatus === 'scheduled' && reminder.notificationId) {
          return reminder;
        }

        if (reminder.notificationId) {
          await cancelReminderNotification(reminder.notificationId);
        }

        const scheduled = await scheduleReminderNotification(reminder);
        return {
          ...reminder,
          notificationId: scheduled.notificationId,
          notificationStatus: scheduled.status,
        };
      })
    );

    const hasChanges = nextReminders.some((reminder, index) => {
      const current = currentReminders[index];
      return (
        current?.notificationId !== reminder.notificationId ||
        current?.notificationStatus !== reminder.notificationStatus
      );
    });

    if (hasChanges) {
      setReminders(nextReminders);
    }

    return true;
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
      if (permission === 'granted') {
        void syncReminderNotifications(permission);
      }
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void refreshNotificationPermission().then((permission) => {
        if (permission === 'granted') {
          void syncReminderNotifications(permission);
        }
      });
      void refreshAppleCalendarPermission();
    });

    return () => {
      subscription.remove();
    };
  }, [hydrated]);

  useEffect(() => {
    const receiveSub = Notifications.addNotificationReceivedListener((event) => {
      if (!settings.ttsEnabled) {
        return;
      }

      const reminderId = String(event.request.content.data?.reminderId ?? '');
      const reminder = reminders.find((item) => item.id === reminderId);
      if (reminder) {
        speakReminder(reminder.title);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!settings.ttsEnabled) {
        return;
      }

      const reminderId = String(response.notification.request.content.data?.reminderId ?? '');
      const reminder = reminders.find((item) => item.id === reminderId);
      if (reminder) {
        speakReminder(reminder.title);
      }
    });

    return () => {
      receiveSub.remove();
      responseSub.remove();
    };
  }, [reminders, settings.ttsEnabled]);

  const remainingFreeReminders = Number.POSITIVE_INFINITY;
  const pendingPermissionReminders = reminders.filter(
    (reminder) =>
      reminder.notificationStatus === 'permission_required' &&
      reminderCanScheduleNotification(reminder)
  ).length;

  const value = useMemo<GhostContextValue>(
    () => ({
      hydrated,
      reminders: reminders
        .slice()
        .sort((a, b) => dayjs(a.remindAt).valueOf() - dayjs(b.remindAt).valueOf()),
      settings,
      usageState: normalizeUsageState(usageState),
      remainingFreeReminders,
      notificationPermission,
      pendingPermissionReminders,
      completeOnboarding: () => {
        setSettings((current) => ({ ...current, hasSeenOnboarding: true }));
      },
      updateSettings: (patch) => {
        setSettings((current) => normalizeSettings({ ...current, ...patch }));
      },
      requestNotificationAccess: async () => {
        const permission = await requestNotificationPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          await syncReminderNotifications(permission);
          return true;
        }

        return false;
      },
      openNotificationSettings: async () => {
        await openSystemSettings();
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
            message: 'Apple Calendar متاح على iPhone فقط.',
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

        if (nextEnabled) {
          return {
            enabled: true,
          };
        }

        const message =
          accessResult.status === 'restricted'
            ? 'الوصول إلى التقويم مقيّد على هذا الجهاز.'
            : accessResult.status === 'denied'
              ? 'تم إيقاف الوصول إلى التقويم. اسمح به من إعدادات النظام إذا أردت المزامنة.'
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
      },
      resetAppData: async () => {
        await Promise.all(
          remindersRef.current.map((reminder) =>
            cancelReminderNotification(reminder.notificationId)
          )
        );
        await clearGoogleCalendarCredentials();
        setReminders([]);
        setSettings(defaultSettings);
        setUsageState(defaultUsageState);
        await clearPersistedState();
      },
      createReminder: async (draft, originalTranscript) => {
        const normalizedUsage = normalizeUsageState(usageState);
        const title = draft.title.trim();

        if (!title) {
          return { ok: false, reason: 'لازم اسم المهمة يبقى واضح.' };
        }

        const eventAt = dayjs(draft.eventAt).second(0).millisecond(0).toISOString();
        const remindAt = dayjs(eventAt)
          .subtract(draft.offsetMinutes, 'minute')
          .toISOString();

        if (
          draft.recurrence === 'none' &&
          dayjs(remindAt).isBefore(dayjs().add(1, 'minute'))
        ) {
          return { ok: false, reason: 'وقت التذكير لازم يكون قدام شوية.' };
        }

        const shouldSyncCalendar =
          Platform.OS === 'ios'
            ? settings.appleCalendar.autoSyncEnabled
            : Boolean(draft.addToCalendar);

        const reminder: Reminder = {
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
          calendarSyncStatus: shouldSyncCalendar ? 'pending' : 'none',
        };

        const scheduled = await scheduleReminderNotification(reminder);
        reminder.notificationId = scheduled.notificationId;
        reminder.notificationStatus = scheduled.status;

        setReminders((current) => [reminder, ...current]);
        setUsageState({
          ...normalizedUsage,
          createdCount: normalizedUsage.createdCount + 1,
        });

        if (shouldSyncCalendar) {
          void createCalendarEvent({
            title,
            date: eventAt,
            reminderOffset: draft.offsetMinutes,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            googleCalendar: settings.googleCalendar,
          })
            .then((calendarResult) => {
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
              if (__DEV__) {
                console.warn('Calendar sync failed', error);
              }
            });
        }

        return scheduled.status === 'permission_required'
          ? {
              ok: true,
              warning: 'التذكير اتحفظ، لكن لازم تفعّل الإشعارات علشان يوصلك في وقته.',
            }
          : { ok: true };
      },
      updateReminder: async (id, draft, originalTranscript) => {
        const existing = reminders.find((item) => item.id === id);
        if (!existing) {
          return { ok: false, reason: 'التذكير ده مش موجود.' };
        }

        const title = draft.title.trim();
        if (!title) {
          return { ok: false, reason: 'لازم اسم المهمة يبقى واضح.' };
        }

        const eventAt = dayjs(draft.eventAt).second(0).millisecond(0).toISOString();
        const remindAt = dayjs(eventAt)
          .subtract(draft.offsetMinutes, 'minute')
          .toISOString();

        if (
          draft.recurrence === 'none' &&
          dayjs(remindAt).isBefore(dayjs().add(1, 'minute'))
        ) {
          return { ok: false, reason: 'وقت التذكير لازم يكون قدام شوية.' };
        }

        if (existing.notificationId) {
          await cancelReminderNotification(existing.notificationId);
        }

        const nextReminder: Reminder = {
          ...existing,
          title,
          category: draft.category,
          originalTranscript: originalTranscript.trim() || existing.originalTranscript,
          eventAt,
          remindAt,
          offsetMinutes: draft.offsetMinutes,
          recurrence: draft.recurrence,
          status: 'scheduled',
          notificationStatus: 'permission_required',
          calendarSyncStatus: existing.calendarSyncStatus,
          calendarProvider: existing.calendarProvider,
          calendarEventId: existing.calendarEventId,
        };

        const scheduled = await scheduleReminderNotification(nextReminder);
        nextReminder.notificationId = scheduled.notificationId;
        nextReminder.notificationStatus = scheduled.status;

        setReminders((current) =>
          current.map((item) => (item.id === id ? nextReminder : item))
        );

        return scheduled.status === 'permission_required'
          ? {
              ok: true,
              warning: 'التعديل اتحفظ، لكن الإشعارات ما زالت غير مفعّلة لهذا التذكير.',
            }
          : { ok: true };
      },
      removeReminder: async (id) => {
        const target = reminders.find((item) => item.id === id);
        if (target?.notificationId) {
          await cancelReminderNotification(target.notificationId);
        }

        setReminders((current) => current.filter((item) => item.id !== id));
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
