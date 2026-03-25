import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { GhostButton } from '../components/GhostButton';
import { ReminderCard } from '../components/ReminderCard';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';
import { buildShareMessage } from '../utils/ghostPersonality';
import { buildManualReminderDraft } from '../utils/reminders';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderList'>;

export function ReminderListScreen({ navigation }: Props) {
  const { reminders, removeReminder, settings } = useGhost();
  const recurringCount = reminders.filter(
    (reminder) => reminder.recurrence === 'daily' || reminder.recurrence === 'weekly'
  ).length;

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
      <Text style={styles.title}>كل تذكيراتك في مكان واحد</Text>
      <Text style={styles.subtitle}>
        راقب يومك كله من شاشة واحدة، مع حذف أو مراجعة أي تذكير بسرعة.
      </Text>

      <GhostButton label="أضف تذكيرًا يدويًا" variant="secondary" onPress={openManualCreate} />

      <LinearGradient colors={['#0D92BF', '#1ABAE9']} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>ملخص سريع</Text>
          </View>
          <Text style={styles.heroCaption}>نظرة هادئة على التذكيرات المحفوظة</Text>
        </View>

        <View style={styles.heroPrimaryRow}>
          <View style={styles.heroCountBlock}>
            <Text style={styles.heroValue}>{reminders.length}</Text>
            <Text style={styles.heroValueLabel}>إجمالي التذكيرات</Text>
          </View>
          <View style={styles.heroCountAccent}>
            <View style={styles.heroCountAccentDot} />
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNumber}>{recurringCount}</Text>
            <Text style={styles.heroStatText}>متكرر</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNumber}>{Math.max(reminders.length - recurringCount, 0)}</Text>
            <Text style={styles.heroStatText}>مرة واحدة</Text>
          </View>
        </View>
      </LinearGradient>

      {reminders.length === 0 ? (
        <SectionCard title="لا يوجد شيء هنا بعد" subtitle="ابدأ يدويًا أو ارجع للتسجيل الصوتي.">
          <GhostButton label="أضف أول تذكير يدويًا" onPress={openManualCreate} />
          <GhostButton
            label="ارجع وسجّل بالصوت"
            variant="secondary"
            onPress={() => navigation.navigate('Home')}
          />
        </SectionCard>
      ) : (
        reminders.map((reminder) => (
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
          />
        ))
      )}
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
    writingDirection: 'rtl',
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
});
