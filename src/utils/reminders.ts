import dayjs from 'dayjs';
import { Reminder, ReminderDraft } from '../types';

export function buildManualReminderDraft(now = new Date()): ReminderDraft {
  const eventAt = dayjs(now).add(1, 'hour').startOf('hour');

  return {
    title: '',
    category: 'personal',
    eventAt: eventAt.toISOString(),
    offsetMinutes: 0,
    recurrence: 'none',
  };
}

export function reminderCanScheduleNotification(reminder: Reminder) {
  return (
    reminder.recurrence !== 'none' ||
    dayjs(reminder.remindAt).isAfter(dayjs().add(1, 'minute'))
  );
}
