import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import dayjs from 'dayjs';
import { Linking, Platform } from 'react-native';
import {
  NotificationPermissionState,
  Reminder,
  ReminderNotificationStatus,
} from '../types';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
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

function buildTrigger(reminder: Reminder): Notifications.NotificationTriggerInput {
  const remindAt = new Date(reminder.remindAt);

  if (reminder.recurrence === 'daily') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: remindAt.getHours(),
      minute: remindAt.getMinutes(),
    };
  }

  if (reminder.recurrence === 'weekly') {
    const weekday = remindAt.getDay() === 0 ? 1 : remindAt.getDay() + 1;
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour: remindAt.getHours(),
      minute: remindAt.getMinutes(),
    };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: remindAt,
  };
}

export async function scheduleReminderNotification(reminder: Reminder) {
  const permissionState = await requestNotificationPermission();
  if (permissionState !== 'granted') {
    return {
      status: 'permission_required' as ReminderNotificationStatus,
    };
  }

  await configureAndroidChannel();

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'تذكير من VoiceGhost',
      body: reminder.title,
      data: {
        reminderId: reminder.id,
      },
      sound: 'default',
    },
    trigger: buildTrigger(reminder),
  });

  return {
    notificationId,
    status: 'scheduled' as ReminderNotificationStatus,
  };
}

export async function cancelReminderNotification(notificationId?: string) {
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
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
  return dayjs(reminder.remindAt).isBefore(dayjs());
}
