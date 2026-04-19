import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import dayjs from 'dayjs';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import { Reminder } from '../types';
import { colors, fonts, radii, spacing } from '../theme';
import { isTabletWidth } from '../utils/layout';
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
  onEdit?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  onSnooze10m?: () => void;
  onSnooze1h?: () => void;
}

function EditGlyph() {
  return (
    <View style={styles.editGlyphWrap}>
      <View style={styles.editGlyphCard} />
      <View style={styles.editGlyphLineTop} />
      <View style={styles.editGlyphLineBottom} />
      <View style={styles.editGlyphPencilBody} />
      <View style={styles.editGlyphPencilTip} />
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
  onEdit,
  onDelete,
  onComplete,
  onSnooze10m,
  onSnooze1h,
}: ReminderCardProps) {
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
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
        ? 'Reminder'
        : 'التذكير';
  const showTriggeredMeta =
    reminder.lastTriggeredAt && dayjs(reminder.lastTriggeredAt).isValid();
  const showStateBadge = snapshot.bucket !== 'upcoming';

  return (
    <Pressable onPress={onPress} style={[styles.card, tabletLayout && styles.cardTablet]}>
      <View style={[styles.header, tabletLayout && styles.headerTablet]}>
        <View style={styles.badgeRow}>
          <View style={[styles.categoryBadge, tabletLayout && styles.badgeTablet]}>
              <Text style={[styles.categoryBadgeText, tabletLayout && styles.badgeTextTablet]}>
              {getReminderCategoryLabel(reminder.category, settings.uiLanguage)}
              </Text>
            </View>
          <View style={[styles.badge, tabletLayout && styles.badgeTablet]}>
            <Text style={[styles.badgeText, tabletLayout && styles.badgeTextTablet]}>
              {getRecurrenceLabel(reminder.recurrence, settings.uiLanguage)}
            </Text>
          </View>
          {showStateBadge ? (
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
                  tabletLayout && styles.badgeTextTablet,
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
          ) : null}
          {reminder.notificationStatus === 'permission_required' ? (
            <View style={[styles.warningBadge, tabletLayout && styles.badgeTablet]}>
              <Text style={[styles.warningBadgeText, tabletLayout && styles.badgeTextTablet]}>
                {settings.uiLanguage === 'en' ? 'Waiting for notifications' : 'بانتظار الإشعارات'}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actionsRow}>
          {onEdit ? (
            <Pressable onPress={onEdit} style={[styles.editChip, tabletLayout && styles.iconChipTablet]}>
              <EditGlyph />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete} style={[styles.deleteChip, tabletLayout && styles.iconChipTablet]}>
              <TrashGlyph />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={[styles.title, tabletLayout && styles.titleTablet]}>{reminder.title}</Text>
      <Text style={[styles.meta, tabletLayout && styles.metaTablet]}>
        {reminderTimeLabel}: {toArabicDateTimeLabel(snapshot.activeReminderAt, settings.uiLanguage)}
      </Text>
      <Text style={[styles.metaSecondary, tabletLayout && styles.metaSecondaryTablet]}>
        {settings.uiLanguage === 'en' ? 'Event:' : 'المعاد:'}{' '}
        {toArabicDateTimeLabel(reminder.eventAt, settings.uiLanguage)}
      </Text>
      <Text style={[styles.metaSecondary, tabletLayout && styles.metaSecondaryTablet]}>
        {settings.uiLanguage === 'en' ? 'Offset:' : 'الفاصل:'}{' '}
        {relativeReminderLabel(reminder.offsetMinutes, settings.uiLanguage)}
      </Text>

      {showTriggeredMeta ? (
        <Text style={[styles.helperMeta, tabletLayout && styles.helperMetaTablet]}>
          {settings.uiLanguage === 'en' ? 'Last alert:' : 'آخر تنبيه:'}{' '}
          {toArabicDateTimeLabel(reminder.lastTriggeredAt!, settings.uiLanguage)}
        </Text>
      ) : null}

      {reminder.notificationStatus === 'permission_required' ? (
        <Text style={[styles.warningMeta, tabletLayout && styles.warningMetaTablet]}>
          {settings.uiLanguage === 'en'
            ? 'The reminder is saved, but notifications will not arrive until app notifications are enabled.'
            : 'التذكير محفوظ، لكن الإشعار مش هيوصل قبل ما تفعّل إشعارات التطبيق.'}
        </Text>
      ) : null}

      {canAct ? (
        <View style={styles.quickActionsRow}>
          {onSnooze1h ? (
            <Pressable onPress={onSnooze1h} style={[styles.quickGhostAction, tabletLayout && styles.quickActionTablet]}>
              <Text style={[styles.quickGhostActionText, tabletLayout && styles.quickActionTextTablet]}>
                {settings.uiLanguage === 'en' ? '1h' : 'ساعة'}
              </Text>
            </Pressable>
          ) : null}
          {onSnooze10m ? (
            <Pressable onPress={onSnooze10m} style={[styles.quickGhostAction, tabletLayout && styles.quickActionTablet]}>
              <Text style={[styles.quickGhostActionText, tabletLayout && styles.quickActionTextTablet]}>
                {settings.uiLanguage === 'en' ? '10m' : '10 د'}
              </Text>
            </Pressable>
          ) : null}
          {onComplete ? (
            <Pressable onPress={onComplete} style={[styles.quickPrimaryAction, tabletLayout && styles.quickActionTablet]}>
              <Text style={[styles.quickPrimaryActionText, tabletLayout && styles.quickActionTextTablet]}>
                {copy.common.done}
              </Text>
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
  cardTablet: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerTablet: {
    gap: spacing.md,
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
  badgeTablet: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badgeTextTablet: {
    fontSize: 15,
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
  iconChipTablet: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
  },
  editGlyphWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGlyphCard: {
    width: 12,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  editGlyphLineTop: {
    position: 'absolute',
    top: 4,
    width: 5,
    height: 1.5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  editGlyphLineBottom: {
    position: 'absolute',
    top: 7,
    width: 4,
    height: 1.5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  editGlyphPencilBody: {
    position: 'absolute',
    width: 7,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    transform: [{ rotate: '-42deg' }],
    right: -1,
    bottom: 2,
  },
  editGlyphPencilTip: {
    position: 'absolute',
    right: 3,
    bottom: 1,
    width: 0,
    height: 0,
    borderTopWidth: 2.5,
    borderBottomWidth: 2.5,
    borderLeftWidth: 3,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.primaryDark,
    transform: [{ rotate: '-42deg' }],
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
  titleTablet: {
    fontSize: 26,
    lineHeight: 38,
  },
  meta: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metaTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  metaSecondary: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metaSecondaryTablet: {
    fontSize: 15,
    lineHeight: 24,
  },
  helperMeta: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  helperMetaTablet: {
    fontSize: 14,
  },
  warningMeta: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  warningMetaTablet: {
    fontSize: 15,
    lineHeight: 24,
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
  quickActionTablet: {
    minHeight: 54,
    minWidth: 96,
  },
  quickActionTextTablet: {
    fontSize: 17,
  },
});
