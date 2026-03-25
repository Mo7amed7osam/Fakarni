import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GhostButton } from '../components/GhostButton';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeechFailed'>;

export function SpeechFailedScreen({ navigation, route }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.errorOrb}>
        <Text style={styles.errorOrbText}>!</Text>
      </View>
      <Text style={styles.title}>التسجيل ما كملش بالشكل المطلوب</Text>
      <Text style={styles.text}>{route.params.reason}</Text>
      {route.params.transcript ? (
        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptLabel}>النص الملتقط</Text>
          <Text style={styles.transcriptText}>{route.params.transcript}</Text>
        </View>
      ) : null}
      <GhostButton label="حاول مرة تانية" onPress={() => navigation.replace('Home')} />
      <GhostButton
        label="افتح المساعدة"
        variant="secondary"
        onPress={() => navigation.navigate('HelpFaq')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  errorOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignSelf: 'center',
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOrbText: {
    fontSize: 42,
    color: colors.danger,
    fontFamily: fonts.bold,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  transcriptCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  transcriptLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  transcriptText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
