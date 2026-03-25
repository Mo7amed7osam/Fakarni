import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { GhostButton } from '../components/GhostButton';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';
import { getGhostModeLabel } from '../utils/ghostPersonality';

const ghostModes = ['sassy', 'coach', 'mom', 'calm'] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const {
    settings,
    updateSettings,
    notificationPermission,
    pendingPermissionReminders,
    requestNotificationAccess,
    openNotificationSettings,
  } = useGhost();
  const notificationsReady = notificationPermission === 'granted';
  const notificationActionLabel =
    notificationPermission === 'blocked' ? 'افتح إعدادات النظام' : 'فعّل الإشعارات';

  async function handleNotificationAction() {
    if (notificationPermission === 'blocked') {
      await openNotificationSettings();
      return;
    }

    await requestNotificationAccess();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>إعدادات VoiceGhost</Text>
      <Text style={styles.subtitle}>
        الإعدادات الأساسية، الإشعارات، وتجربة الصوت في مكان واحد.
      </Text>

      <LinearGradient colors={['#0D92BF', '#18B7E8']} style={styles.heroCard}>
        <Text style={styles.heroLabel}>حالة التطبيق</Text>
        <Text style={styles.heroValue}>{notificationsReady ? 'جاهز' : 'يحتاج خطوة'}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>صوت عربي</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {notificationsReady ? 'إشعارات مفعّلة' : 'الإشعارات غير مكتملة'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <SectionCard title="الصوت والتنبيهات">
        <View style={styles.row}>
          <Switch
            value={settings.ttsEnabled}
            onValueChange={(value) => updateSettings({ ttsEnabled: value })}
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>تشغيل التذكير بصوت عربي</Text>
            <Text style={styles.rowSubtitle}>
              يعمل أثناء فتح التطبيق أو عند الدخول من الإشعار.
            </Text>
          </View>
        </View>

        <View style={styles.notificationStatusCard}>
          <Text style={styles.notificationStatusTitle}>
            {notificationsReady ? 'الإشعارات شغالة' : 'الإشعارات تحتاج تفعيل'}
          </Text>
          <Text style={styles.notificationStatusText}>
            {notificationsReady
              ? 'أي تذكير جديد سيتم ربطه بالإشعار تلقائيًا.'
              : pendingPermissionReminders > 0
                ? `يوجد ${pendingPermissionReminders} تذكيرات محفوظة بانتظار الإذن ليتم جدولة إشعاراتها.`
                : 'فعّل الإشعارات حتى تصل التذكيرات في وقتها.'}
          </Text>
        </View>

        <GhostButton
          label={notificationActionLabel}
          variant="secondary"
          onPress={() => {
            void handleNotificationAction();
          }}
        />
      </SectionCard>

      <SectionCard title="شخصية الجوست" subtitle="اختار الردود اللي تناسبك أكتر">
        <View style={styles.modeRow}>
          {ghostModes.map((mode) => (
            <Pressable
              key={mode}
              onPress={() => updateSettings({ ghostMode: mode })}
              style={[
                styles.modeChip,
                settings.ghostMode === mode && styles.modeChipActive,
              ]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  settings.ghostMode === mode && styles.modeChipTextActive,
                ]}
              >
                {getGhostModeLabel(mode)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="جاهزية النسخة">
        <View style={styles.planCard}>
          <Text style={styles.planValue}>الإصدار الأول</Text>
          <Text style={styles.planText}>
            النسخة الحالية تركّز على التذكيرات الصوتية واليدوية، مع مراجعة سريعة قبل الحفظ.
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="المساعدة والخصوصية">
        <Pressable onPress={() => navigation.navigate('HelpFaq')} style={styles.linkCard}>
          <Text style={styles.linkLabel}>الأسئلة الشائعة، الخصوصية، والدعم</Text>
        </Pressable>
      </SectionCard>
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
    paddingBottom: 48,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    maxWidth: 280,
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
    gap: spacing.md,
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
  },
  heroValue: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 34,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroPillText: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notificationStatusCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.12)',
  },
  notificationStatusTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.warning,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notificationStatusText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.warning,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  planCard: {
    backgroundColor: '#E9F8FE',
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#CBEAF7',
  },
  planValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.primaryDark,
    textAlign: 'right',
  },
  planText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  linkCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  linkLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardMuted,
  },
  modeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeChipText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    writingDirection: 'rtl',
  },
  modeChipTextActive: {
    color: colors.white,
  },
});
