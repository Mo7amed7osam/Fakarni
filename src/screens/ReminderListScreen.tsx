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
        <Text style={styles.heroLabel}>ملخص سريع</Text>
        <Text style={styles.heroValue}>{reminders.length}</Text>
        <Text style={styles.heroCaption}>إجمالي التذكيرات المحفوظة</Text>
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
    padding: spacing.xl,
    gap: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroValue: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 42,
    textAlign: 'right',
  },
  heroCaption: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroStats: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroStatNumber: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'right',
  },
  heroStatText: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
