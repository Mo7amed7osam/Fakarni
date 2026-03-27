import { useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { GlassSurface } from '../components/GlassSurface';
import { GhostButton } from '../components/GhostButton';
import { getAppCopy } from '../content/appCopy';
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

export function ReminderListScreen({ navigation }: Props) {
  const {
    reminders,
    removeReminder,
    completeReminder,
    settings,
    snoozeReminder,
    feedbackPrompt,
    dismissFeedbackPrompt,
    respondToFeedbackPrompt,
    submitFeedback,
    requestFeedbackReview,
    trackFeedbackShareSuggested,
  } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const [activeFilter, setActiveFilter] = useState<ReminderListFilter>('today');
  const [showDoneSummary, setShowDoneSummary] = useState(false);

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

  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  }

  const filters: Array<{ id: ReminderListFilter; label: string }> = [
    { id: 'today', label: copy.common.today },
    { id: 'upcoming', label: copy.common.upcoming },
    { id: 'overdue', label: copy.common.overdue },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonLabel}>{copy.common.back}</Text>
          <Text style={styles.backButtonIcon}>→</Text>
        </Pressable>

        <Text style={styles.title}>{copy.reminderList.title}</Text>
        <Text style={styles.subtitle}>{copy.reminderList.subtitle}</Text>

        <Pressable onPress={openManualCreate} style={styles.manualLink}>
          <Text style={styles.manualLinkText}>{copy.reminderList.manualCta}</Text>
        </Pressable>

        <GlassSurface
          style={styles.heroStrip}
          contentStyle={styles.heroStripContent}
          intensity={46}
          overlayColor="rgba(255,255,255,0.22)"
          borderColor="rgba(255,255,255,0.5)"
        >
          <View style={styles.heroStripMain}>
            <Text style={styles.heroStripValue}>{counts.today}</Text>
            <Text style={styles.heroStripLabel}>{copy.reminderList.compactDue}</Text>
          </View>

          <View style={styles.heroStripStats}>
            <View style={[styles.heroMiniPill, counts.overdue > 0 && styles.heroMiniPillOverdue]}>
              <Text
                style={[
                  styles.heroMiniPillText,
                  counts.overdue > 0 && styles.heroMiniPillTextOverdue,
                ]}
              >
                {counts.overdue} {copy.common.overdue}
              </Text>
            </View>
            <View style={styles.heroMiniPill}>
              <Text style={styles.heroMiniPillText}>
                {counts.done} {copy.reminderList.compactDone}
              </Text>
            </View>
          </View>
        </GlassSurface>

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
          <SectionCard title={copy.reminderList.emptyTitle} subtitle={copy.reminderList.emptySubtitle}>
            <GhostButton label={copy.reminderList.addFirstManual} onPress={openManualCreate} />
            <GhostButton
              label={copy.reminderList.backToVoice}
              variant="secondary"
              onPress={() => navigation.navigate('Home')}
            />
          </SectionCard>
        ) : visibleReminders.length === 0 ? (
          <SectionCard
            title={copy.reminderList.filterQuietTitle}
            subtitle={
              activeFilter === 'today'
                ? copy.reminderList.filterQuietToday
                : activeFilter === 'upcoming'
                  ? copy.reminderList.filterQuietUpcoming
                  : copy.reminderList.filterQuietOverdue
            }
          >
            <GhostButton
              label={copy.reminderList.switchFilter}
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
                  message: buildShareMessage(reminder, settings.ghostMode, settings.uiLanguage),
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
          <SectionCard title={copy.reminderList.doneTitle} subtitle={copy.reminderList.doneSubtitle}>
            <Pressable onPress={() => setShowDoneSummary((current) => !current)} style={styles.doneToggle}>
              <Text style={styles.doneToggleText}>
                {showDoneSummary ? copy.reminderList.hideDone : copy.reminderList.showDone}
              </Text>
            </Pressable>
            {showDoneSummary ? (
              <Text style={styles.doneSummary}>
                {copy.reminderList.doneSummary(doneReminders.length)}
              </Text>
            ) : null}
          </SectionCard>
        ) : null}
      </ScrollView>

      <FeedbackSheet
        visible={Boolean(feedbackPrompt)}
        language={settings.uiLanguage}
        source={feedbackPrompt?.source ?? null}
        onClose={dismissFeedbackPrompt}
        onSentimentSelect={respondToFeedbackPrompt}
        onSubmit={submitFeedback}
        onRequestReview={requestFeedbackReview}
        onShareSuggested={trackFeedbackShareSuggested}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 52,
  },
  backButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  backButtonLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  backButtonIcon: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primaryDark,
    marginTop: -1,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  manualLink: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  manualLinkText: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  heroStrip: {
    borderRadius: radii.lg,
  },
  heroStripContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroStripMain: {
    alignItems: 'flex-end',
    gap: 2,
  },
  heroStripValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'right',
  },
  heroStripLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroStripStats: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  heroMiniPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.cardMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
  },
  heroMiniPillOverdue: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(185,28,28,0.12)',
  },
  heroMiniPillText: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  heroMiniPillTextOverdue: {
    color: '#B91C1C',
  },
  filterRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  filterChip: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(75,63,207,0.18)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
    fontSize: 15,
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
  doneToggle: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xs,
  },
  doneToggleText: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
});
