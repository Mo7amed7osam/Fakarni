import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { GhostButton } from '../components/GhostButton';
import { useGhost } from '../context/GhostContext';
import { RootStackParamList } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const { completeOnboarding } = useGhost();

  return (
    <LinearGradient
      colors={['#F4EFE6', '#FFF6E8', '#F6D3C2']}
      style={styles.container}
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>صوتك أولاً. والعربي أولاً.</Text>
        <Text style={styles.title}>قول المهمة وسيب VoiceGhost يجهزها</Text>
        <Text style={styles.description}>
          لمسة واحدة على الميكروفون ثم اتكلم. المسار اليدوي موجود فقط كخطة بديلة عند الحاجة.
        </Text>
      </View>

      <View style={styles.featureRail}>
        <View style={styles.feature}>
          <Text style={styles.featureTitle}>قلها وسيتم الاهتمام بها</Text>
          <Text style={styles.featureText}>المهمة، الوقت، والتنبيه قبلها في خطوة واحدة</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureTitle}>الصوت هو الأساس</Text>
          <Text style={styles.featureText}>والإدخال اليدوي موجود فقط لو احتجته كحل بديل</Text>
        </View>
      </View>

      <GhostButton
        label="ابدأ الآن"
        onPress={() => {
          completeOnboarding();
          navigation.replace('Home');
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  heroCard: {
    marginTop: spacing.xxl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  description: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  featureRail: {
    gap: spacing.md,
  },
  feature: {
    backgroundColor: 'rgba(255,249,240,0.75)',
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(215,201,178,0.8)',
  },
  featureTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  featureText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
