import { useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { GhostButton } from '../components/GhostButton';
import { getAppCopy } from '../content/appCopy';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import { isAnalyticsConfigured } from '../services/analytics';
import { openSystemSettings } from '../services/notifications';
import { isLLMConfigured } from '../services/llm';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';
import { getResponsiveContentWidth, isTabletWidth } from '../utils/layout';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpFaq'>;

const faqArabic = [
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

const faqEnglish = [
  {
    question: 'How should I say it?',
    answer:
      'Start with a simple action like remind me, then say the task and time. Example: remind me to submit the project tomorrow at 5.',
  },
  {
    question: 'What does one hour before mean?',
    answer:
      'The app calculates the event time, subtracts one hour, and schedules the reminder before the event.',
  },
  {
    question: 'Do I have to type?',
    answer:
      'No. The confirmation screen lets you adjust the title or time only if the voice result was unclear.',
  },
  {
    question: 'Will it speak out loud when the reminder fires?',
    answer:
      'Voice playback works while the app is open or when you come back from the notification, depending on your sound settings.',
  },
];

export function HelpFaqScreen({ navigation, route }: Props) {
  const {
    settings,
    notificationPermission,
    pendingPermissionReminders,
    requestNotificationAccess,
    openNotificationSettings,
    resetAppData,
    feedbackPrompt,
    openManualFeedback,
    dismissFeedbackPrompt,
    respondToFeedbackPrompt,
    submitFeedback,
    requestFeedbackReview,
    trackFeedbackShareSuggested,
  } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
  const contentMaxWidth = getResponsiveContentWidth(width, 980);
  const faq = settings.uiLanguage === 'en' ? faqEnglish : faqArabic;
  const llmEnabled = isLLMConfigured();
  const analyticsConfigured = isAnalyticsConfigured();
  const notificationActionLabel =
    notificationPermission === 'blocked'
      ? copy.settings.notificationActionBlocked
      : copy.settings.notificationActionAsk;

  useEffect(() => {
    if (!route.params?.openFeedback) {
      return;
    }

    openManualFeedback();
    navigation.setParams({ openFeedback: undefined });
  }, [navigation, openManualFeedback, route.params?.openFeedback]);

  function handleResetData() {
    Alert.alert(
      copy.help.resetTitle,
      copy.help.resetBody,
      [
        {
          text: copy.help.cancel,
          style: 'cancel',
        },
        {
          text: copy.help.reset,
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

    await requestNotificationAccess('help');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.contentInner, { maxWidth: contentMaxWidth }]}>
      <Text style={[styles.title, tabletLayout && styles.titleTablet]}>{copy.help.title}</Text>

      <SectionCard
        title={copy.help.privacyTitle}
        subtitle={copy.help.privacySubtitle}
      >
        <View style={styles.copyBlock}>
          <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>
            {settings.uiLanguage === 'en'
              ? 'Reminder data is stored locally on the device. The microphone only starts after you tap the record button.'
              : 'بيانات التذكيرات تُحفظ محليًا على الجهاز. الميكروفون لا يعمل إلا بعد ضغطك على زر التسجيل.'}
          </Text>
          <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>
            {settings.uiLanguage === 'en'
              ? 'Speech recognition depends on system services on the device, not on always-on recording inside the app.'
              : 'التعرف على الكلام يعتمد على خدمات النظام في الجهاز، وليس على تسجيل صوت دائم داخل التطبيق.'}
          </Text>
          <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>
            {settings.uiLanguage === 'en'
              ? llmEnabled
                ? 'Smart parsing is enabled and routes through the configured Fakarni parsing gateway.'
                : 'Remote smart parsing is not enabled in this build. Reminder parsing stays on the local rules-first path.'
              : llmEnabled
                ? 'التحليل الذكي مفعّل ويمر عبر بوابة التحليل الخاصة بـ Fakarni.'
                : 'التحليل الذكي عن بُعد غير مفعّل في هذه النسخة، وسيبقى التحليل المحلي المعتمد على القواعد هو المسار الأساسي.'}
          </Text>
          <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>
            {settings.uiLanguage === 'en'
              ? 'If you enable calendar saving, the app may create an event in the device calendar or Google Calendar based on your setup.'
              : 'وإذا فعّلت إضافة التذكير للتقويم، قد يُنشئ التطبيق حدثًا في تقويم الجهاز أو Google Calendar حسب إعداداتك.'}
          </Text>
          <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>
            {settings.uiLanguage === 'en'
              ? analyticsConfigured
                ? `Anonymous analytics: ${settings.analytics.enabled ? 'enabled' : 'disabled'}, and raw transcripts or reminder titles are not sent.`
                : 'Anonymous analytics are not configured in this build.'
              : analyticsConfigured
                ? `التحليلات المجهولة: ${settings.analytics.enabled ? 'مفعّلة' : 'متوقفة'}، ولا ترسل transcript الخام أو أسماء التذكيرات.`
                : 'التحليلات المجهولة غير مهيأة في هذه النسخة.'}
          </Text>
        </View>
      </SectionCard>

      <SectionCard title={copy.help.permissionsTitle}>
        <View style={[styles.permissionCard, tabletLayout && styles.permissionCardTablet]}>
          <Text style={[styles.permissionTitle, tabletLayout && styles.permissionTitleTablet]}>
            {notificationPermission === 'granted'
              ? settings.uiLanguage === 'en'
                ? 'Notifications enabled'
                : 'الإشعارات مفعّلة'
              : notificationPermission === 'blocked'
                ? settings.uiLanguage === 'en'
                  ? 'Notifications blocked by the system'
                  : 'الإشعارات مرفوضة من النظام'
                : settings.uiLanguage === 'en'
                  ? 'Notifications are incomplete'
                  : 'الإشعارات غير مكتملة'}
          </Text>
          <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>
            {pendingPermissionReminders > 0
              ? settings.uiLanguage === 'en'
                ? `${pendingPermissionReminders} saved reminders will be linked to notifications after permission is granted.`
                : `يوجد ${pendingPermissionReminders} تذكيرات محفوظة ستُربط بالإشعارات بعد السماح بها.`
              : settings.uiLanguage === 'en'
                ? 'Enable notifications to make sure reminders arrive on time.'
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
          label={copy.common.openSystemSettings}
          variant="ghost"
          onPress={() => {
            void openSystemSettings();
          }}
        />
      </SectionCard>

      <SectionCard
        title={copy.help.feedbackTitle}
        subtitle={copy.help.feedbackSubtitle}
      >
        <GhostButton
          label={copy.help.feedbackAction}
          variant="secondary"
          onPress={openManualFeedback}
        />
      </SectionCard>

      <SectionCard title={copy.help.deviceDataTitle}>
        <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>
          {settings.uiLanguage === 'en'
            ? 'You can delete all local reminders and settings from inside the app at any time.'
            : 'يمكنك حذف كل التذكيرات والإعدادات المحلية من داخل التطبيق في أي وقت.'}
        </Text>
        <Pressable
          onPress={handleResetData}
          style={[styles.dangerCard, tabletLayout && styles.dangerCardTablet]}
        >
          <Text style={[styles.dangerLabel, tabletLayout && styles.dangerLabelTablet]}>
            {copy.help.resetAllData}
          </Text>
        </Pressable>
      </SectionCard>

      {faq.map((item) => (
        <SectionCard key={item.question} title={item.question}>
          <View>
            <Text style={[styles.answer, tabletLayout && styles.answerTablet]}>{item.answer}</Text>
          </View>
        </SectionCard>
      ))}
      </View>

      <FeedbackSheet
        visible={feedbackPrompt?.source === 'settings_manual'}
        language={settings.uiLanguage}
        source={feedbackPrompt?.source ?? null}
        onClose={dismissFeedbackPrompt}
        onSentimentSelect={respondToFeedbackPrompt}
        onSubmit={submitFeedback}
        onRequestReview={requestFeedbackReview}
        onShareSuggested={trackFeedbackShareSuggested}
      />
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
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: 48,
  },
  contentInner: {
    width: '100%',
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  titleTablet: {
    fontSize: 34,
    lineHeight: 46,
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
  answerTablet: {
    fontSize: 17,
    lineHeight: 28,
  },
  permissionCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.12)',
  },
  permissionCardTablet: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  permissionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.warning,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  permissionTitleTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  dangerCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(199,75,67,0.12)',
  },
  dangerCardTablet: {
    padding: spacing.lg,
  },
  dangerLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.danger,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dangerLabelTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
});
