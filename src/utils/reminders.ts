import dayjs, { Dayjs } from 'dayjs';
import { Recurrence, Reminder, ReminderDraft } from '../types';

export type ReminderTimelineBucket = 'today' | 'upcoming' | 'overdue' | 'done';

export interface ReminderTimelineSnapshot {
  bucket: ReminderTimelineBucket;
  activeReminderAt: string;
  isCompleted: boolean;
  isOverdue: boolean;
  isSnoozed: boolean;
  source: 'current' | 'next' | 'snooze';
}

const weekdayRecurringDays = [1, 2, 3, 4, 5];

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

export function getRecurrenceLabel(recurrence: Recurrence) {
  switch (recurrence) {
    case 'daily':
      return 'يومي';
    case 'weekly':
      return 'أسبوعي';
    case 'weekdays':
      return 'أيام العمل';
    default:
      return 'مرة واحدة';
  }
}

export function isRecurringReminder(reminder: Pick<Reminder, 'recurrence'>) {
  return reminder.recurrence !== 'none';
}

export function reminderCanScheduleNotification(reminder: Reminder) {
  if (isRecurringReminder(reminder)) {
    return true;
  }

  const target = reminder.snoozedUntil ?? reminder.remindAt;
  return dayjs(target).isAfter(dayjs().add(1, 'minute'));
}

function normalizeOccurrence(base: Dayjs, candidate: Dayjs) {
  return candidate
    .hour(base.hour())
    .minute(base.minute())
    .second(0)
    .millisecond(0);
}

function getWeeklyDays(recurrence: Recurrence, remindAt: Dayjs) {
  if (recurrence === 'weekdays') {
    return weekdayRecurringDays;
  }

  if (recurrence === 'weekly') {
    return [remindAt.day()];
  }

  return [];
}

export function getReminderBaseLatestOccurrence(
  reminder: Reminder,
  now = dayjs()
): Dayjs | null {
  const base = dayjs(reminder.remindAt);
  if (!base.isValid()) {
    return null;
  }

  if (reminder.recurrence === 'none') {
    return base.isAfter(now) ? null : base;
  }

  if (reminder.recurrence === 'daily') {
    const todayOccurrence = normalizeOccurrence(base, now);
    if (todayOccurrence.isBefore(base)) {
      return null;
    }

    if (todayOccurrence.isAfter(now)) {
      const previousOccurrence = todayOccurrence.subtract(1, 'day');
      return previousOccurrence.isBefore(base) ? null : previousOccurrence;
    }

    return todayOccurrence;
  }

  const recurringDays = getWeeklyDays(reminder.recurrence, base);
  for (let offset = 0; offset <= 14; offset += 1) {
    const candidateDay = now.startOf('day').subtract(offset, 'day');
    if (!recurringDays.includes(candidateDay.day())) {
      continue;
    }

    const occurrence = normalizeOccurrence(base, candidateDay);
    if (occurrence.isBefore(base)) {
      continue;
    }

    if (occurrence.isAfter(now)) {
      continue;
    }

    return occurrence;
  }

  return null;
}

export function getReminderBaseNextOccurrence(
  reminder: Reminder,
  now = dayjs()
): Dayjs | null {
  const base = dayjs(reminder.remindAt);
  if (!base.isValid()) {
    return null;
  }

  if (reminder.recurrence === 'none') {
    return base.isAfter(now) ? base : null;
  }

  if (reminder.recurrence === 'daily') {
    const todayOccurrence = normalizeOccurrence(base, now);
    if (todayOccurrence.isBefore(base)) {
      return base;
    }

    return todayOccurrence.isAfter(now) ? todayOccurrence : todayOccurrence.add(1, 'day');
  }

  const recurringDays = getWeeklyDays(reminder.recurrence, base);
  for (let offset = 0; offset <= 14; offset += 1) {
    const candidateDay = now.startOf('day').add(offset, 'day');
    if (!recurringDays.includes(candidateDay.day())) {
      continue;
    }

    const occurrence = normalizeOccurrence(base, candidateDay);
    if (occurrence.isBefore(base) || !occurrence.isAfter(now)) {
      continue;
    }

    return occurrence;
  }

  return normalizeOccurrence(base, now.startOf('day').add(21, 'day'));
}

function isCurrentOccurrenceCompleted(reminder: Reminder, occurrence: Dayjs | null) {
  if (!occurrence || !reminder.completedAt) {
    return false;
  }

  const completedAt = dayjs(reminder.completedAt);
  return completedAt.isSame(occurrence) || completedAt.isAfter(occurrence);
}

export function getReminderTimelineSnapshot(
  reminder: Reminder,
  now = dayjs()
): ReminderTimelineSnapshot {
  const baseRemindAt = dayjs(reminder.remindAt);
  const snoozedUntil = reminder.snoozedUntil ? dayjs(reminder.snoozedUntil) : null;

  if (
    reminder.recurrence === 'none' &&
    (reminder.status === 'done' || Boolean(reminder.completedAt))
  ) {
    return {
      bucket: 'done',
      activeReminderAt: (snoozedUntil ?? baseRemindAt).toISOString(),
      isCompleted: true,
      isOverdue: false,
      isSnoozed: Boolean(reminder.snoozedUntil),
      source: snoozedUntil ? 'snooze' : 'current',
    };
  }

  if (snoozedUntil) {
    const snoozeBucket: ReminderTimelineBucket = snoozedUntil.isAfter(now)
      ? snoozedUntil.isSame(now, 'day')
        ? 'today'
        : 'upcoming'
      : 'overdue';

    return {
      bucket: snoozeBucket,
      activeReminderAt: snoozedUntil.toISOString(),
      isCompleted: false,
      isOverdue: snoozeBucket === 'overdue',
      isSnoozed: true,
      source: 'snooze',
    };
  }

  const latestOccurrence = getReminderBaseLatestOccurrence(reminder, now);
  const nextOccurrence = getReminderBaseNextOccurrence(reminder, now);

  if (
    reminder.recurrence !== 'none' &&
    latestOccurrence &&
    !isCurrentOccurrenceCompleted(reminder, latestOccurrence)
  ) {
    const bucket: ReminderTimelineBucket = latestOccurrence.isBefore(now)
      ? 'overdue'
      : latestOccurrence.isSame(now, 'day')
        ? 'today'
        : 'upcoming';

    return {
      bucket,
      activeReminderAt: latestOccurrence.toISOString(),
      isCompleted: false,
      isOverdue: bucket === 'overdue',
      isSnoozed: false,
      source: 'current',
    };
  }

  const target = nextOccurrence ?? latestOccurrence ?? baseRemindAt;
  const bucket: ReminderTimelineBucket =
    reminder.recurrence === 'none' && target.isBefore(now)
      ? 'overdue'
      : target.isSame(now, 'day')
        ? 'today'
        : target.isAfter(now)
          ? 'upcoming'
          : 'done';

  return {
    bucket,
    activeReminderAt: target.toISOString(),
    isCompleted:
      reminder.recurrence === 'none'
        ? reminder.status === 'done' || Boolean(reminder.completedAt)
        : false,
    isOverdue: bucket === 'overdue',
    isSnoozed: false,
    source: nextOccurrence ? 'next' : 'current',
  };
}

export function sortRemindersByTimeline(reminders: Reminder[], now = dayjs()) {
  return reminders
    .slice()
    .sort(
      (a, b) =>
        dayjs(getReminderTimelineSnapshot(a, now).activeReminderAt).valueOf() -
        dayjs(getReminderTimelineSnapshot(b, now).activeReminderAt).valueOf()
    );
}

export function getNextDueReminder(reminders: Reminder[], now = dayjs()) {
  return sortRemindersByTimeline(
    reminders.filter((reminder) => getReminderTimelineSnapshot(reminder, now).bucket !== 'done'),
    now
  )[0];
}

export function getOverdueReminderCount(reminders: Reminder[], now = dayjs()) {
  return reminders.filter(
    (reminder) => getReminderTimelineSnapshot(reminder, now).bucket === 'overdue'
  ).length;
}
