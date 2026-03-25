import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GhostButton } from '../components/GhostButton';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import { openSystemSettings } from '../services/notifications';
import { isLLMConfigured } from '../services/llm';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpFaq'>;

const faq = [
  {
    question: 'أقول الجملة إزاي؟',
    answer: 'ابدأ بفعل بسيط زي: فكرني، وبعدها المهمة والوقت. مثال: فكرني أسلّم المشروع بكرة الساعة 5.',
  },
  {
    question: 'إيه معنى قبل ساعة؟',
    answer: 'التطبيق يحسب وقت الحدث ثم يطرح ساعة ويضبط التذكير قبل الموعد.',
  },
  {
    question: 'هل لازم أكتب؟',
    answer: 'لا، لكن شاشة التأكيد تتيح لك تعديل الاسم أو الوقت لو الصوت لم يكن واضحاً.',
  },
  {
    question: 'هل الكلام بيطلع صوت وقت التذكير؟',
    answer: 'الصوت العربي يعمل أثناء فتح التطبيق أو عند الدخول إليه من الإشعار حسب إعدادات الصوت.',
  },
];

export function HelpFaqScreen({ navigation }: Props) {
  const {
    notificationPermission,
    pendingPermissionReminders,
    requestNotificationAccess,
    openNotificationSettings,
    resetAppData,
  } = useGhost();
  const llmEnabled = isLLMConfigured();
  const notificationActionLabel =
    notificationPermission === 'blocked' ? 'افتح إعدادات النظام' : 'فعّل الإشعارات';

  function handleResetData() {
    Alert.alert(
      'مسح البيانات المحلية',
      'سيتم حذف كل التذكيرات والإعدادات المخزنة على هذا الجهاز فقط.',
      [
        {
          text: 'إلغاء',
          style: 'cancel',
        },
        {
          text: 'مسح',
          style: 'destructive',
          onPress: () => {
            void resetAppData().then(() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Onboarding' }],
              });
            });
          },
        },
      ]
    );
  }

  async function handleNotificationAction() {
    if (notificationPermission === 'blocked') {
      await openNotificationSettings();
      return;
    }

    await requestNotificationAccess();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>المساعدة والخصوصية</Text>

      <SectionCard
        title="ملخص الخصوصية"
        subtitle="مهم قبل النشر: هذا النص يشرح سلوك التطبيق الحالي للمستخدم داخل الواجهة."
      >
        <View style={styles.copyBlock}>
          <Text style={styles.answer}>
            بيانات التذكيرات تُحفظ محليًا على الجهاز. الميكروفون لا يعمل إلا بعد ضغطك على زر التسجيل.
          </Text>
          <Text style={styles.answer}>
            التعرف على الكلام يعتمد على خدمات النظام في الجهاز، وليس على تسجيل صوت دائم داخل التطبيق.
          </Text>
          <Text style={styles.answer}>
            التحليل الذكي الخارجي: {llmEnabled ? 'مفعّل في هذه النسخة.' : 'غير مفعّل في هذه النسخة.'}
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="الإشعارات والصلاحيات">
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>
            {notificationPermission === 'granted'
              ? 'الإشعارات مفعّلة'
              : notificationPermission === 'blocked'
                ? 'الإشعارات مرفوضة من النظام'
                : 'الإشعارات غير مكتملة'}
          </Text>
          <Text style={styles.answer}>
            {pendingPermissionReminders > 0
              ? `يوجد ${pendingPermissionReminders} تذكيرات محفوظة ستُربط بالإشعارات بعد السماح بها.`
              : 'فعّل الإشعارات لضمان وصول التذكيرات في وقتها.'}
          </Text>
        </View>
        <GhostButton
          label={notificationActionLabel}
          variant="secondary"
          onPress={() => {
            void handleNotificationAction();
          }}
        />
        <GhostButton
          label="فتح إعدادات النظام"
          variant="ghost"
          onPress={() => {
            void openSystemSettings();
          }}
        />
      </SectionCard>

      <SectionCard title="البيانات على جهازك">
        <Text style={styles.answer}>
          يمكنك حذف كل التذكيرات والإعدادات المحلية من داخل التطبيق في أي وقت.
        </Text>
        <Pressable onPress={handleResetData} style={styles.dangerCard}>
          <Text style={styles.dangerLabel}>مسح كل البيانات المحلية</Text>
        </Pressable>
      </SectionCard>

      {faq.map((item) => (
        <SectionCard key={item.question} title={item.question}>
          <View>
            <Text style={styles.answer}>{item.answer}</Text>
          </View>
        </SectionCard>
      ))}
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
    gap: spacing.md,
    paddingBottom: 48,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  copyBlock: {
    gap: spacing.xs,
  },
  answer: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  permissionCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.12)',
  },
  permissionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.warning,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dangerCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(199,75,67,0.12)',
  },
  dangerLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.danger,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
