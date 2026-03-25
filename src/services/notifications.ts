import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import dayjs from 'dayjs';
import { Linking, Platform } from 'react-native';
import {
  NotificationPermissionState,
  Reminder,
  ReminderNotificationStatus,
} from '../types';

export const REMINDER_NOTIFICATION_CATEGORY_ID = 'voiceghost-reminder-actions';
export const REMINDER_NOTIFICATION_ACTION_DONE = 'done';
export const REMINDER_NOTIFICATION_ACTION_SNOOZE_10M = 'snooze_10m';
export const REMINDER_NOTIFICATION_ACTION_SNOOZE_1H = 'snooze_1h';

export type ReminderNotificationKind = 'primary' | 'follow_up' | 'snooze';

export interface ReminderNotificationScheduleResult {
  notificationId?: string;
  notificationIds?: string[];
  status: ReminderNotificationStatus;
}

export interface ReminderNotificationResponseDetails {
  reminderId: string;
  actionIdentifier: string;
  kind: ReminderNotificationKind;
}

function buildWeeklyExpoWeekday(jsWeekday: number) {
  return jsWeekday === 0 ? 1 : jsWeekday + 1;
}

function buildBaseTriggers(reminder: Reminder): Notifications.NotificationTriggerInput[] {
  const remindAt = new Date(reminder.remindAt);
  const hour = remindAt.getHours();
  const minute = remindAt.getMinutes();

  if (reminder.recurrence === 'daily') {
    return [
      {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    ];
  }

  if (reminder.recurrence === 'weekly') {
    return [
      {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: buildWeeklyExpoWeekday(remindAt.getDay()),
        hour,
        minute,
      },
    ];
  }

  if (reminder.recurrence === 'weekdays') {
    return [1, 2, 3, 4, 5].map((weekday) => ({
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: buildWeeklyExpoWeekday(weekday),
      hour,
      minute,
    }));
  }

  return [
    {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: remindAt,
    },
  ];
}

function buildNotificationContent(
  reminder: Reminder,
  kind: ReminderNotificationKind
): Notifications.NotificationContentInput {
  return {
    title: kind === 'follow_up' ? 'متابعة من VoiceGhost' : 'تذكير من VoiceGhost',
    body:
      kind === 'follow_up'
        ? `لسه موجودة: ${reminder.title}`
        : kind === 'snooze'
          ? `رجعنا نفتكرك: ${reminder.title}`
          : reminder.title,
    data: {
      reminderId: reminder.id,
      kind,
    },
    categoryIdentifier: REMINDER_NOTIFICATION_CATEGORY_ID,
    sound: 'default',
  };
}

export async function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  await Notifications.setNotificationCategoryAsync(
    REMINDER_NOTIFICATION_CATEGORY_ID,
    [
      {
        identifier: REMINDER_NOTIFICATION_ACTION_DONE,
        buttonTitle: 'Done',
      },
      {
        identifier: REMINDER_NOTIFICATION_ACTION_SNOOZE_10M,
        buttonTitle: 'Snooze 10m',
      },
      {
        identifier: REMINDER_NOTIFICATION_ACTION_SNOOZE_1H,
        buttonTitle: 'Snooze 1h',
      },
    ],
    {
      previewPlaceholder: 'تذكير من VoiceGhost',
      intentIdentifiers: [],
      categorySummaryFormat: 'تذكير',
    }
  );

  await configureAndroidChannel();
}

export async function ensureNotificationPermissions() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) {
    return 'granted';
  }

  return permissions.canAskAgain ? 'undetermined' : 'blocked';
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return 'granted';
  }

  if (!existing.canAskAgain) {
    return 'blocked';
  }

  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) {
    return 'granted';
  }

  return requested.canAskAgain ? 'undetermined' : 'blocked';
}

export async function openSystemSettings() {
  await Linking.openSettings();
}

export async function configureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('voiceghost-reminders', {
    name: 'VoiceGhost Reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function scheduleReminderNotification(
  reminder: Reminder
): Promise<ReminderNotificationScheduleResult> {
  const permissionState = await requestNotificationPermission();
  if (permissionState !== 'granted') {
    return {
      status: 'permission_required',
    };
  }

  await configureAndroidChannel();

  const triggers = buildBaseTriggers(reminder);
  const notificationIds = await Promise.all(
    triggers.map((trigger) =>
      Notifications.scheduleNotificationAsync({
        content: buildNotificationContent(reminder, 'primary'),
        trigger,
      })
    )
  );

  return {
    notificationId: notificationIds[0],
    notificationIds,
    status: 'scheduled',
  };
}

export async function scheduleSnoozedReminderNotification(
  reminder: Reminder,
  date: string
) {
  return Notifications.scheduleNotificationAsync({
    content: buildNotificationContent(reminder, 'snooze'),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(date),
    },
  });
}

export async function scheduleFollowUpReminderNotification(
  reminder: Reminder,
  date: string
) {
  return Notifications.scheduleNotificationAsync({
    content: buildNotificationContent(reminder, 'follow_up'),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(date),
    },
  });
}

export async function cancelReminderNotification(notificationId?: string) {
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelReminderNotifications(notificationIds?: string[]) {
  if (!notificationIds?.length) {
    return;
  }

  await Promise.all(
    notificationIds.map((notificationId) =>
      Notifications.cancelScheduledNotificationAsync(notificationId)
    )
  );
}

export function getReminderNotificationResponseDetails(
  response: Notifications.NotificationResponse
): ReminderNotificationResponseDetails | null {
  const reminderId = String(response.notification.request.content.data?.reminderId ?? '');
  const kind = String(response.notification.request.content.data?.kind ?? 'primary');

  if (!reminderId) {
    return null;
  }

  return {
    reminderId,
    actionIdentifier: response.actionIdentifier,
    kind:
      kind === 'follow_up' || kind === 'snooze'
        ? kind
        : 'primary',
  };
}

export async function getLastNotificationResponse() {
  return Notifications.getLastNotificationResponseAsync();
}

export async function clearLastNotificationResponse() {
  await Notifications.clearLastNotificationResponseAsync();
}

export function speakReminder(title: string) {
  Speech.stop();
  Speech.speak(`تذكير: ${title}`, {
    language: 'ar',
    rate: 0.9,
    pitch: 1.0,
  });
}

export function reminderIsOverdue(reminder: Reminder) {
  const target = reminder.snoozedUntil ?? reminder.remindAt;
  return dayjs(target).isBefore(dayjs());
}
