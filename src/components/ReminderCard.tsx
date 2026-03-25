import { Pressable, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import { Reminder } from '../types';
import { colors, fonts, radii, spacing } from '../theme';
import {
  relativeReminderLabel,
  toArabicDateTimeLabel,
} from '../utils/arabic';
import { getReminderCategoryLabel } from '../utils/categorization';
import {
  getRecurrenceLabel,
  getReminderTimelineSnapshot,
} from '../utils/reminders';

interface ReminderCardProps {
  reminder: Reminder;
  onPress?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  onSnooze10m?: () => void;
  onSnooze1h?: () => void;
}

function PencilGlyph() {
  return (
    <View style={styles.pencilWrap}>
      <View style={styles.pencilBody} />
      <View style={styles.pencilTip} />
    </View>
  );
}

function TrashGlyph() {
  return (
    <View style={styles.trashWrap}>
      <View style={styles.trashLid} />
      <View style={styles.trashBody}>
        <View style={styles.trashLine} />
        <View style={styles.trashLine} />
      </View>
    </View>
  );
}

function getStateLabel(reminder: Reminder) {
  return getStateLabelForLanguage(reminder, 'ar-EG');
}

function getStateLabelForLanguage(reminder: Reminder, language: 'ar-EG' | 'en') {
  const snapshot = getReminderTimelineSnapshot(reminder);

  if (language === 'en') {
    if (snapshot.bucket === 'done') {
      return 'Done';
    }

    if (snapshot.isSnoozed) {
      return 'Snoozed';
    }

    if (snapshot.bucket === 'overdue') {
      return 'Overdue';
    }

    if (snapshot.bucket === 'today') {
      return 'Today';
    }

    return 'Upcoming';
  }

  if (snapshot.bucket === 'done') {
    return 'تم';
  }

  if (snapshot.isSnoozed) {
    return 'مؤجل';
  }

  if (snapshot.bucket === 'overdue') {
    return 'فات وقته';
  }

  if (snapshot.bucket === 'today') {
    return 'اليوم';
  }

  return 'قادم';
}

export function ReminderCard({
  reminder,
  onPress,
  onShare,
  onEdit,
  onDelete,
  onComplete,
  onSnooze10m,
  onSnooze1h,
}: ReminderCardProps) {
  const { settings } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const snapshot = getReminderTimelineSnapshot(reminder);
  const canAct =
    reminder.recurrence !== 'none' || snapshot.bucket !== 'done';
  const reminderTimeLabel =
    snapshot.source === 'snooze'
      ? settings.uiLanguage === 'en'
        ? 'Snoozed reminder'
        : 'الجرس المؤجل'
      : settings.uiLanguage === 'en'
        ? 'Next reminder'
        : 'التذكير القادم';
  const showTriggeredMeta =
    reminder.lastTriggeredAt && dayjs(reminder.lastTriggeredAt).isValid();

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
              {getReminderCategoryLabel(reminder.category, settings.uiLanguage)}
              </Text>
            </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {getRecurrenceLabel(reminder.recurrence, settings.uiLanguage)}
            </Text>
          </View>
          <View
            style={[
              styles.stateBadge,
              snapshot.bucket === 'overdue'
                ? styles.stateBadgeOverdue
                : snapshot.bucket === 'done'
                  ? styles.stateBadgeDone
                  : styles.stateBadgeToday,
            ]}
          >
            <Text
              style={[
                styles.stateBadgeText,
                snapshot.bucket === 'overdue'
                  ? styles.stateBadgeTextOverdue
                  : snapshot.bucket === 'done'
                    ? styles.stateBadgeTextDone
                    : styles.stateBadgeTextToday,
              ]}
            >
              {getStateLabelForLanguage(reminder, settings.uiLanguage)}
            </Text>
          </View>
          {reminder.notificationStatus === 'permission_required' ? (
            <View style={styles.warningBadge}>
              <Text style={styles.warningBadgeText}>
                {settings.uiLanguage === 'en' ? 'Waiting for notifications' : 'بانتظار الإشعارات'}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actionsRow}>
          {onShare ? (
            <Pressable onPress={onShare} style={styles.shareChip}>
              <Text style={styles.shareText}>{copy.common.share}</Text>
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable onPress={onEdit} style={styles.editChip}>
              <PencilGlyph />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete} style={styles.deleteChip}>
              <TrashGlyph />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.title}>{reminder.title}</Text>
      <Text style={styles.meta}>
        {reminderTimeLabel}: {toArabicDateTimeLabel(snapshot.activeReminderAt, settings.uiLanguage)}
      </Text>
      <Text style={styles.metaSecondary}>
        {settings.uiLanguage === 'en' ? 'Event:' : 'المعاد:'}{' '}
        {toArabicDateTimeLabel(reminder.eventAt, settings.uiLanguage)}
      </Text>
      <Text style={styles.metaSecondary}>
        {settings.uiLanguage === 'en' ? 'Offset:' : 'الفاصل:'}{' '}
        {relativeReminderLabel(reminder.offsetMinutes, settings.uiLanguage)}
      </Text>

      {showTriggeredMeta ? (
        <Text style={styles.helperMeta}>
          {settings.uiLanguage === 'en' ? 'Last alert:' : 'آخر تنبيه:'}{' '}
          {toArabicDateTimeLabel(reminder.lastTriggeredAt!, settings.uiLanguage)}
        </Text>
      ) : null}

      {reminder.notificationStatus === 'permission_required' ? (
        <Text style={styles.warningMeta}>
          {settings.uiLanguage === 'en'
            ? 'The reminder is saved, but notifications will not arrive until app notifications are enabled.'
            : 'التذكير محفوظ، لكن الإشعار مش هيوصل قبل ما تفعّل إشعارات التطبيق.'}
        </Text>
      ) : null}

      {canAct ? (
        <View style={styles.quickActionsRow}>
          {onSnooze1h ? (
            <Pressable onPress={onSnooze1h} style={styles.quickGhostAction}>
              <Text style={styles.quickGhostActionText}>
                {settings.uiLanguage === 'en' ? '1h' : 'ساعة'}
              </Text>
            </Pressable>
          ) : null}
          {onSnooze10m ? (
            <Pressable onPress={onSnooze10m} style={styles.quickGhostAction}>
              <Text style={styles.quickGhostActionText}>
                {settings.uiLanguage === 'en' ? '10m' : '10 د'}
              </Text>
            </Pressable>
          ) : null}
          {onComplete ? (
            <Pressable onPress={onComplete} style={styles.quickPrimaryAction}>
              <Text style={styles.quickPrimaryActionText}>{copy.common.done}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  badge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  categoryBadge: {
    backgroundColor: 'rgba(15,118,110,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  categoryBadgeText: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  badgeText: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  stateBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  stateBadgeToday: {
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  stateBadgeOverdue: {
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  stateBadgeDone: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  stateBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  stateBadgeTextToday: {
    color: '#1D4ED8',
  },
  stateBadgeTextOverdue: {
    color: '#B91C1C',
  },
  stateBadgeTextDone: {
    color: '#15803D',
  },
  warningBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  warningBadgeText: {
    color: colors.warning,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
    alignItems: 'center',
  },
  editChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareChip: {
    minWidth: 56,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(0,229,168,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  shareText: {
    color: '#0F766E',
    fontFamily: fonts.bold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  pencilWrap: {
    width: 14,
    height: 14,
    transform: [{ rotate: '-35deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilBody: {
    width: 11,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  pencilTip: {
    position: 'absolute',
    right: -1,
    width: 0,
    height: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 4,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.primaryDark,
  },
  deleteChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashWrap: {
    width: 14,
    height: 15,
    alignItems: 'center',
  },
  trashLid: {
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.danger,
    marginBottom: 1,
  },
  trashBody: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderTopWidth: 1.5,
    borderColor: colors.danger,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
  },
  trashLine: {
    width: 1.5,
    height: 5,
    borderRadius: 1,
    backgroundColor: colors.danger,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  meta: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metaSecondary: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  helperMeta: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  warningMeta: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  quickActionsRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickPrimaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPrimaryActionText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14,
    writingDirection: 'rtl',
  },
  quickGhostAction: {
    minWidth: 72,
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  quickGhostActionText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
    writingDirection: 'rtl',
  },
});
