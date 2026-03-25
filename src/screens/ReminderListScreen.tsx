import { useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { GhostButton } from '../components/GhostButton';
import { ReminderCard } from '../components/ReminderCard';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';
import { buildShareMessage } from '../utils/ghostPersonality';
import {
  buildManualReminderDraft,
  getReminderTimelineSnapshot,
} from '../utils/reminders';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderList'>;
type ReminderListFilter = 'today' | 'upcoming' | 'overdue';

const filters: Array<{ id: ReminderListFilter; label: string }> = [
  { id: 'today', label: 'اليوم' },
  { id: 'upcoming', label: 'القادم' },
  { id: 'overdue', label: 'المتأخر' },
];

export function ReminderListScreen({ navigation }: Props) {
  const {
    reminders,
    removeReminder,
    completeReminder,
    settings,
    snoozeReminder,
  } = useGhost();
  const [activeFilter, setActiveFilter] = useState<ReminderListFilter>('today');

  const counts = useMemo(
    () => ({
      today: reminders.filter(
        (reminder) => getReminderTimelineSnapshot(reminder).bucket === 'today'
      ).length,
      upcoming: reminders.filter(
        (reminder) => getReminderTimelineSnapshot(reminder).bucket === 'upcoming'
      ).length,
      overdue: reminders.filter(
        (reminder) => getReminderTimelineSnapshot(reminder).bucket === 'overdue'
      ).length,
      done: reminders.filter(
        (reminder) => getReminderTimelineSnapshot(reminder).bucket === 'done'
      ).length,
    }),
    [reminders]
  );

  const visibleReminders = useMemo(
    () =>
      reminders.filter((reminder) => {
        const bucket = getReminderTimelineSnapshot(reminder).bucket;
        return bucket === activeFilter;
      }),
    [activeFilter, reminders]
  );

  const doneReminders = useMemo(
    () =>
      reminders.filter(
        (reminder) => getReminderTimelineSnapshot(reminder).bucket === 'done'
      ),
    [reminders]
  );

  function openManualCreate() {
    navigation.navigate('Confirmation', {
      mode: 'create',
      draft: buildManualReminderDraft(),
      transcript: '',
      confidence: 1,
      missingFields: [],
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>لوحة المتابعة اليومية</Text>
      <Text style={styles.subtitle}>
        اعمل على ما يحتاج حركة الآن، واترك الأرشفة والضوضاء للخلف.
      </Text>

      <GhostButton label="إضافة يدوية كحل بديل" variant="secondary" onPress={openManualCreate} />

      <LinearGradient colors={['#0D92BF', '#1ABAE9']} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>ملخص متابع</Text>
          </View>
          <Text style={styles.heroCaption}>قائمة تشغيلية سريعة بدل شاشة مزدحمة بلا أولوية</Text>
        </View>

        <View style={styles.heroPrimaryRow}>
          <View style={styles.heroCountBlock}>
            <Text style={styles.heroValue}>{counts.today}</Text>
            <Text style={styles.heroValueLabel}>تحتاج حركة اليوم</Text>
          </View>
          <View style={styles.heroCountAccent}>
            <View style={styles.heroCountAccentDot} />
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNumber}>{counts.overdue}</Text>
            <Text style={styles.heroStatText}>متأخر</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNumber}>{counts.upcoming}</Text>
            <Text style={styles.heroStatText}>قادم</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNumber}>{counts.done}</Text>
            <Text style={styles.heroStatText}>تم</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.filterRow}>
        {filters.map((filter) => {
          const isActive = filter.id === activeFilter;
          const count = counts[filter.id];
          return (
            <Pressable
              key={filter.id}
              onPress={() => setActiveFilter(filter.id)}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                {filter.label}
              </Text>
              <Text style={[styles.filterChipCount, isActive && styles.filterChipCountActive]}>
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {reminders.length === 0 ? (
        <SectionCard title="لا يوجد شيء هنا بعد" subtitle="ابدأ يدويًا أو ارجع للتسجيل الصوتي.">
          <GhostButton label="أضف أول تذكير يدويًا" onPress={openManualCreate} />
          <GhostButton
            label="ارجع وسجّل بالصوت"
            variant="secondary"
            onPress={() => navigation.navigate('Home')}
          />
        </SectionCard>
      ) : visibleReminders.length === 0 ? (
        <SectionCard
          title="الفلتر هادئ الآن"
          subtitle={
            activeFilter === 'today'
              ? 'لا يوجد ما يحتاج تدخل اليوم.'
              : activeFilter === 'upcoming'
                ? 'لا يوجد شيء قادم قريبًا.'
                : 'رائع، لا توجد عناصر متأخرة الآن.'
          }
        >
          <GhostButton
            label="بدّل الفلتر"
            variant="secondary"
            onPress={() =>
              setActiveFilter(
                activeFilter === 'today'
                  ? 'upcoming'
                  : activeFilter === 'upcoming'
                    ? 'overdue'
                    : 'today'
              )
            }
          />
        </SectionCard>
      ) : (
        visibleReminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            onShare={() => {
              void Share.share({
                message: buildShareMessage(reminder, settings.ghostMode),
              });
            }}
            onEdit={() =>
              navigation.navigate('Confirmation', {
                mode: 'edit',
                reminderId: reminder.id,
                draft: {
                  title: reminder.title,
                  category: reminder.category,
                  eventAt: reminder.eventAt,
                  offsetMinutes: reminder.offsetMinutes,
                  recurrence: reminder.recurrence,
                },
                transcript: reminder.originalTranscript,
                confidence: 1,
                missingFields: [],
              })
            }
            onDelete={() => {
              void removeReminder(reminder.id);
            }}
            onComplete={() => {
              void completeReminder(reminder.id, 'list');
            }}
            onSnooze10m={() => {
              void snoozeReminder(reminder.id, 10, 'list');
            }}
            onSnooze1h={() => {
              void snoozeReminder(reminder.id, 60, 'list');
            }}
          />
        ))
      )}

      {doneReminders.length > 0 ? (
        <SectionCard
          title="تم إنهاؤها"
          subtitle="تظهر هنا العناصر ذات المرة الواحدة التي انتهت بالفعل."
        >
          <Text style={styles.doneSummary}>
            أنهيت {doneReminders.length} {doneReminders.length === 1 ? 'تذكيرًا' : 'تذكيرات'}.
          </Text>
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 52,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  heroCard: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: 'rgba(8, 113, 146, 0.26)',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  heroHeader: {
    gap: 6,
    alignItems: 'flex-end',
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroBadgeText: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  heroPrimaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroCountBlock: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  heroCountAccent: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCountAccentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8FE8FF',
  },
  heroValue: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 30,
    textAlign: 'right',
  },
  heroValueLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroCaption: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroStats: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    gap: 2,
  },
  heroStatNumber: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: 'right',
  },
  heroStatText: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  filterRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  filterChip: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  filterChipLabelActive: {
    color: colors.white,
  },
  filterChipCount: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  filterChipCountActive: {
    color: colors.white,
  },
  doneSummary: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
