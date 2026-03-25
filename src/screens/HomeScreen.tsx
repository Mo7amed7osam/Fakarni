import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GhostButton } from '../components/GhostButton';
import { useGhost } from '../context/GhostContext';
import { colors, fonts, radii, spacing } from '../theme';
import { ReminderDraft, RootStackParamList } from '../types';
import { parseReminderText } from '../utils/parser';
import { getReminderCategoryLabel } from '../utils/categorization';
import { buildGhostReply } from '../utils/ghostPersonality';
import { buildManualReminderDraft } from '../utils/reminders';
import {
  relativeReminderLabel,
  toArabicDateTimeLabel,
} from '../utils/arabic';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type PendingParse = {
  draft: ReminderDraft;
  transcript: string;
  confidence: number;
  missingFields: string[];
};

function RemindersGlyph() {
  return (
    <View style={navGlyphStyles.listWrap}>
      {[0, 1, 2].map((line) => (
        <View key={line} style={navGlyphStyles.listRow}>
          <View style={navGlyphStyles.listDot} />
          <View style={navGlyphStyles.listLine} />
        </View>
      ))}
    </View>
  );
}

function SettingsGlyph() {
  return (
    <View style={navGlyphStyles.gearWrap}>
      <View style={navGlyphStyles.gearCenter} />
      <View style={[navGlyphStyles.gearTooth, navGlyphStyles.toothTop]} />
      <View style={[navGlyphStyles.gearTooth, navGlyphStyles.toothBottom]} />
      <View style={[navGlyphStyles.gearTooth, navGlyphStyles.toothLeft]} />
      <View style={[navGlyphStyles.gearTooth, navGlyphStyles.toothRight]} />
    </View>
  );
}

function NavIconButton({
  label,
  onPress,
  variant,
  showLabel = true,
}: {
  label: string;
  onPress: () => void;
  variant: 'settings' | 'reminders';
  showLabel?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navButton}>
      <View style={styles.navIconShell}>
        {variant === 'settings' ? <SettingsGlyph /> : <RemindersGlyph />}
      </View>
      {showLabel ? <Text style={styles.navLabel}>{label}</Text> : null}
    </Pressable>
  );
}

function Waveform({ pulse }: { pulse: Animated.Value }) {
  const scales = [
    [0.35, 0.9],
    [0.55, 1.15],
    [0.8, 1.35],
    [0.55, 1.15],
    [0.35, 0.9],
  ];

  return (
    <View style={styles.waveRow}>
      {scales.map(([from, to], index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              transform: [
                {
                  scaleY: pulse.interpolate({
                    inputRange: [1, 1.08],
                    outputRange: [from, to],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function MicGlyph() {
  return (
    <View style={micGlyphStyles.container}>
      <View style={micGlyphStyles.capsule} />
      <View style={micGlyphStyles.stem} />
      <View style={micGlyphStyles.base} />
    </View>
  );
}

function GhostIllustration() {
  return (
    <LinearGradient
      colors={['#F4F1FF', '#ECE8FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.ghostBadge}
    >
      <View style={styles.ghostShape}>
        <View style={styles.ghostEyes}>
          <View style={styles.ghostEye} />
          <View style={styles.ghostEye} />
        </View>
        <View style={styles.ghostSmile} />
        <View style={styles.ghostTailRow}>
          <View style={styles.ghostTail} />
          <View style={[styles.ghostTail, styles.ghostTailCenter]} />
          <View style={styles.ghostTail} />
        </View>
      </View>
      <View style={styles.ghostSpark} />
    </LinearGradient>
  );
}

const preferredArabicLocales = ['ar-EG', 'ar'];
const quickOffsetOptions = [0, 30, 60, 120];

function getSpeechLocaleLabel(locale: string) {
  if (locale.toLowerCase().startsWith('ar')) {
    return 'مصري';
  }

  return locale;
}

function pickArabicLocale(locales: string[]) {
  const uniqueLocales = Array.from(new Set(locales));

  for (const preferred of preferredArabicLocales) {
    const directMatch = uniqueLocales.find(
      (locale) => locale.toLowerCase() === preferred.toLowerCase()
    );
    if (directMatch) {
      return directMatch;
    }
  }

  return uniqueLocales.find((locale) => locale.toLowerCase().startsWith('ar'));
}

export function HomeScreen({ navigation }: Props) {
  const {
    reminders,
    createReminder,
    settings,
    notificationPermission,
    pendingPermissionReminders,
    requestNotificationAccess,
    openNotificationSettings,
  } = useGhost();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speechLocale, setSpeechLocale] = useState('ar-EG');
  const [pendingParse, setPendingParse] = useState<PendingParse | null>(null);
  const [confirmPaused, setConfirmPaused] = useState(false);
  const [confirmEditing, setConfirmEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastShareText, setToastShareText] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;
  const confirmOpacity = useRef(new Animated.Value(0)).current;
  const confirmScale = useRef(new Animated.Value(0.95)).current;
  const confirmProgress = useRef(new Animated.Value(1)).current;
  const transcriptRef = useRef('');
  const shouldProcessOnEndRef = useRef(false);
  const autoConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPendingParseRef = useRef<PendingParse | null>(null);
  const { width, height } = useWindowDimensions();
  const compact = height < 780;
  const showNavLabel = height >= 760;
  const heroWidth = width - spacing.lg * 2;
  const notificationActionLabel =
    notificationPermission === 'blocked' ? 'افتح الإعدادات' : 'فعّل الإشعارات';

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setErrorMessage('');
    setProcessing(false);
    setPendingParse(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setBusy(false);

    if (!shouldProcessOnEndRef.current) {
      return;
    }

    shouldProcessOnEndRef.current = false;
    const sourceTranscript = transcriptRef.current.trim();
    if (!sourceTranscript) {
      setErrorMessage('لسه ما قولتش حاجة 👻');
      return;
    }

    void processCapturedTranscript(sourceTranscript);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const bestResult = event.results[0]?.transcript ?? '';
    setTranscript(bestResult);
    transcriptRef.current = bestResult;
  });

  useSpeechRecognitionEvent('error', (event) => {
    const isLocaleError =
      event.error === 'language-not-supported' ||
      event.message?.toLowerCase().includes('locale');
    const friendlyMessage = isLocaleError
      ? `الجهاز الحالي لا يدعم ${speechLocale} للتعرف على الكلام. جرّب تفعيل لغة عربية أخرى في النظام أو استخدم جهازاً حقيقياً بدلاً من المحاكي.`
      : event.message || 'فشلنا في فهم الصوت';

    setErrorMessage(friendlyMessage);
    setBusy(false);
    setIsListening(false);
    setProcessing(false);
    shouldProcessOnEndRef.current = false;
  });

  useEffect(() => {
    latestPendingParseRef.current = pendingParse;
  }, [pendingParse]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setToastMessage('');
      setToastShareText('');
    }, 3000);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!isListening) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isListening, pulse]);

  useEffect(() => {
    if (!pendingParse) {
      confirmOpacity.setValue(0);
      confirmScale.setValue(0.95);
      confirmProgress.setValue(1);
      setConfirmPaused(false);
      setConfirmEditing(false);
      if (autoConfirmTimeoutRef.current) {
        clearTimeout(autoConfirmTimeoutRef.current);
        autoConfirmTimeoutRef.current = null;
      }
      return;
    }

    setConfirmPaused(false);
    setConfirmEditing(false);
    confirmOpacity.setValue(0);
    confirmScale.setValue(0.95);
    confirmProgress.setValue(1);

    Animated.parallel([
      Animated.timing(confirmOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(confirmScale, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(confirmProgress, {
        toValue: 0,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();

    autoConfirmTimeoutRef.current = setTimeout(() => {
      const current = latestPendingParseRef.current;
      if (!current) {
        return;
      }

      void confirmPendingParse(current);
    }, 3000);

    return () => {
      if (autoConfirmTimeoutRef.current) {
        clearTimeout(autoConfirmTimeoutRef.current);
        autoConfirmTimeoutRef.current = null;
      }
      confirmProgress.stopAnimation();
    };
  }, [pendingParse, confirmOpacity, confirmProgress, confirmScale]);

  const latestReminder = reminders[0];

  function buildDraftFromParse(parsed: Awaited<ReturnType<typeof parseReminderText>>) {
    return {
      title: parsed.title,
      category: parsed.categorySuggestion,
      eventAt: parsed.eventAt ?? new Date().toISOString(),
      offsetMinutes: parsed.offsetMinutes,
      recurrence: parsed.recurrenceSuggestion ?? 'none',
    } satisfies ReminderDraft;
  }

  function openFullConfirmation(nextPending: PendingParse) {
    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }
    navigation.navigate('Confirmation', {
      mode: 'create',
      draft: nextPending.draft,
      transcript: nextPending.transcript,
      confidence: nextPending.confidence,
      missingFields: nextPending.missingFields,
    });
    setPendingParse(null);
    setTranscript('');
  }

  function openManualCreate() {
    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }

    setPendingParse(null);
    setErrorMessage('');
    navigation.navigate('Confirmation', {
      mode: 'create',
      draft: buildManualReminderDraft(),
      transcript: '',
      confidence: 1,
      missingFields: [],
    });
  }

  function validateDraft(draft: ReminderDraft) {
    if (!draft.title.trim()) {
      return 'اسم المهمة محتاج يتظبط.';
    }

    const remindAt = dayjs(draft.eventAt).subtract(draft.offsetMinutes, 'minute');
    if (draft.recurrence === 'none' && remindAt.isBefore(dayjs().add(1, 'minute'))) {
      return 'راجع الوقت بس.';
    }

    return '';
  }

  function pauseAutoConfirm() {
    if (!pendingParse || confirmPaused) {
      return;
    }

    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }

    confirmProgress.stopAnimation();
    setConfirmPaused(true);
  }

  function enableInlineEdit() {
    pauseAutoConfirm();
    setConfirmEditing(true);
  }

  async function confirmPendingParse(target: PendingParse) {
    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }

    await new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(confirmOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(confirmScale, {
          toValue: 0.97,
          duration: 180,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

    await saveDraft(target.draft, target.transcript);
  }

  async function processCapturedTranscript(sourceTranscript: string) {
    try {
      setProcessing(true);
      const parsed = await parseReminderText(sourceTranscript);
      const draft = buildDraftFromParse(parsed);
      const validationIssue = validateDraft(draft);

      if (!validationIssue && parsed.confidence >= 0.9 && parsed.missingFields.length === 0) {
        await saveDraft(draft, sourceTranscript);
        return;
      }

      const nextPending = {
        draft,
        transcript: sourceTranscript,
        confidence: parsed.confidence,
        missingFields: parsed.missingFields,
      } satisfies PendingParse;

      if (
        validationIssue ||
        parsed.confidence < 0.62 ||
        parsed.missingFields.includes('time') ||
        parsed.missingFields.includes('date')
      ) {
        openFullConfirmation(nextPending);
        return;
      }

      setPendingParse(nextPending);
      setErrorMessage('');
    } catch {
      setErrorMessage('حصلت لخبطة صغيرة. قولها تاني.');
    } finally {
      setProcessing(false);
    }
  }

  async function saveDraft(draft: ReminderDraft, sourceTranscript: string) {
    const validationIssue = validateDraft(draft);
    if (validationIssue) {
      setErrorMessage(validationIssue);
      return;
    }

    const result = await createReminder(draft, sourceTranscript);
    if (!result.ok) {
      setErrorMessage(result.reason ?? 'فيه مشكلة في الحفظ. جرّب تاني.');
      return;
    }

    setPendingParse(null);
    setTranscript('');
    setErrorMessage('');
    const reply = buildGhostReply({
      mode: settings.ghostMode,
      title: draft.title,
      category: draft.category,
      recurrence: draft.recurrence,
    });
    setToastMessage(result.warning ?? reply);
    setToastShareText(
      result.warning
        ? ''
        : ['VoiceGhost 👻', '', `قلت: ${sourceTranscript}`, `الجوست رد: ${reply}`].join('\n')
    );
  }

  async function handleNotificationAction() {
    if (notificationPermission === 'blocked') {
      await openNotificationSettings();
      return;
    }

    await requestNotificationAccess();
  }

  async function resolveSpeechLocale() {
    try {
      const supported = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      const availableLocales = [...supported.installedLocales, ...supported.locales];

      if (!availableLocales.length) {
        return 'ar-EG';
      }

      const arabicLocale = pickArabicLocale(availableLocales);
      if (arabicLocale) {
        return arabicLocale;
      }

      return null;
    } catch {
      return 'ar-EG';
    }
  }

  async function toggleRecording() {
    if (processing) {
      return;
    }

    if (isListening) {
      shouldProcessOnEndRef.current = true;
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    if (busy) {
      return;
    }

    setBusy(true);
    setTranscript('');
    transcriptRef.current = '';
    setPendingParse(null);
    setErrorMessage('');
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setBusy(false);
      setProcessing(false);
      shouldProcessOnEndRef.current = false;
      setErrorMessage('لازم تسمح بالمايك الأول.');
      return;
    }

    const resolvedLocale = await resolveSpeechLocale();
    if (!resolvedLocale) {
      setBusy(false);
      setProcessing(false);
      shouldProcessOnEndRef.current = false;
      setErrorMessage(
        Platform.OS === 'ios'
          ? 'فعّل العربي في النظام الأول.'
          : 'خدمة العربي مش متاحة على الجهاز.'
      );
      return;
    }

    setSpeechLocale(resolvedLocale);
    shouldProcessOnEndRef.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: resolvedLocale,
      interimResults: true,
      continuous: false,
      addsPunctuation: false,
      maxAlternatives: 1,
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.backgroundOrbTop} />
      <View pointerEvents="none" style={styles.backgroundOrbBottom} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <NavIconButton
            label="الإعدادات"
            onPress={() => navigation.navigate('Settings')}
            variant="settings"
            showLabel={showNavLabel}
          />
          <NavIconButton
            label="تذكيراتك"
            onPress={() => navigation.navigate('ReminderList')}
            variant="reminders"
            showLabel={showNavLabel}
          />
        </View>

        <LinearGradient
          colors={['#4E3ED1', '#6C5CE7', '#8C7FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, compact && styles.heroCompact]}
        >
          <View style={styles.heroGlowTop} />
          <View style={styles.heroGlowBottom} />
          <View style={styles.heroGlass} />

          <View style={styles.heroCopy}>
            <View style={styles.heroTopRow}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>جاهز</Text>
              </View>
            </View>

            <Text
              style={[
                styles.title,
                compact && styles.titleCompact,
                { maxWidth: heroWidth * 0.72 },
              ]}
            >
              قول بس وهنفكرك
            </Text>
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
              {processing ? 'بنفهمها' : 'عايز تفكر بإيه؟'}
            </Text>
            <View style={styles.localePill}>
              <View style={styles.localeDot} />
              <Text style={styles.localeHint}>{getSpeechLocaleLabel(speechLocale)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.micStage, compact && styles.micStageCompact]}>
          <Animated.View
            style={[
              styles.micGlow,
              {
                opacity: pulse.interpolate({
                  inputRange: [1, 1.08],
                  outputRange: [0.2, 0.42],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [1, 1.08],
                      outputRange: [1, 1.12],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <View style={[styles.micRingOuter, compact && styles.micRingOuterCompact]}>
              <View style={[styles.micRingInner, compact && styles.micRingInnerCompact]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={toggleRecording}
                  style={[styles.micButton, compact && styles.micButtonCompact]}
                >
                  {isListening ? <View style={styles.stopSquare} /> : <MicGlyph />}
                </Pressable>
              </View>
            </View>
          </Animated.View>

          <Text style={[styles.micHint, compact && styles.micHintCompact]}>
            {processing ? 'بظبطهالك' : isListening ? 'سامعك' : 'قول بس'}
          </Text>
          <Text style={[styles.micSubhint, compact && styles.micSubhintCompact]}>
            {processing
              ? 'ثانية ونطلعها صح.'
              : isListening
                ? 'كمّل للآخر.'
                : 'دوس مرة واتكلم.'}
          </Text>
          {isListening ? <Waveform pulse={pulse} /> : null}
          {processing ? (
            <ActivityIndicator color={colors.primaryDark} style={styles.processingSpinner} />
          ) : null}
        </View>

        <View style={[styles.transcriptBox, compact && styles.transcriptBoxCompact]}>
          <View style={styles.transcriptHeader}>
            <Text style={styles.transcriptLabel}>
              {pendingParse ? 'فهمنا' : 'سمعنا'}
            </Text>
            {busy ? (
              <Text style={styles.transcriptLive}>دلوقتي</Text>
            ) : pendingParse ? (
              <Text style={styles.transcriptLive}>راجع بسرعة</Text>
            ) : null}
          </View>
          {busy && !transcript ? (
            <View style={styles.transcriptRow}>
              <View style={[styles.transcriptBadge, styles.transcriptBadgeBusy]}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
              </View>
              <Text style={[styles.transcriptText, compact && styles.transcriptTextCompact]}>
                بنسمعك دلوقتي...
              </Text>
            </View>
          ) : pendingParse ? (
            <View style={styles.summaryBlock}>
              <Text
                numberOfLines={2}
                style={[styles.transcriptText, compact && styles.transcriptTextCompact]}
              >
                {pendingParse.draft.title}
              </Text>
              <Text style={styles.summaryMeta}>
                {toArabicDateTimeLabel(pendingParse.draft.eventAt)}
              </Text>
              <Text style={styles.summaryMeta}>
                {relativeReminderLabel(pendingParse.draft.offsetMinutes)}
              </Text>
            </View>
          ) : transcript || processing ? (
            <Text
              numberOfLines={compact ? 2 : 3}
              style={[styles.transcriptText, compact && styles.transcriptTextCompact]}
            >
              {processing ? 'بنحلل الكلام ونظبط الوقت والفئة...' : transcript}
            </Text>
          ) : null}
          {!busy && !pendingParse && !processing && !transcript ? (
            <View style={styles.transcriptRow}>
              <GhostIllustration />
              <View style={styles.transcriptCopy}>
                <Text style={styles.transcriptEmptyTitle}>لسه ما قولتش حاجة</Text>
                <Text style={styles.transcriptEmptyMeta}>
                  قول أول تذكير ليك أو اكتبه يدويًا
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {errorMessage ? (
          <View style={styles.feedbackCard}>
            <Text numberOfLines={2} style={styles.errorText}>
              {errorMessage}
            </Text>
            {!processing ? (
              <Pressable
                onPress={() => {
                  setErrorMessage('');
                  void toggleRecording();
                }}
                style={styles.feedbackAction}
              >
                <Text style={styles.feedbackActionText}>قولها تاني</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.bottomStack}>
          <GhostButton
            label="أضف تذكيرًا يدويًا"
            variant="secondary"
            onPress={openManualCreate}
          />

          {pendingPermissionReminders > 0 ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>
                {pendingPermissionReminders === 1
                  ? 'في تذكير محفوظ بانتظار تفعيل الإشعارات.'
                  : `في ${pendingPermissionReminders} تذكيرات محفوظة بانتظار تفعيل الإشعارات.`}
              </Text>
              <Pressable onPress={() => void handleNotificationAction()} style={styles.warningAction}>
                <Text style={styles.warningActionText}>{notificationActionLabel}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={() => navigation.navigate('ReminderList')}
            style={[styles.dashboardCard, styles.recentCard]}
          >
            <View style={styles.dashboardHeader}>
              <Text style={styles.dashboardEyebrow}>الجاي</Text>
              <Text style={styles.dashboardLink}>عرض الكل</Text>
            </View>

            {latestReminder ? (
              <View style={styles.dashboardBody}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {getReminderCategoryLabel(latestReminder.category)}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.dashboardTitle}>
                  {latestReminder.title}
                </Text>
                <View style={styles.nextMetaRow}>
                  <View style={styles.nextMetaBadge}>
                    <View style={styles.nextMetaDot} />
                  </View>
                  <Text numberOfLines={1} style={styles.nextMetaText}>
                    {toArabicDateTimeLabel(latestReminder.remindAt)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.dashboardEmptyState}>
                <View style={styles.nextEmptyIcon}>
                  <View style={styles.nextEmptyIconDot} />
                </View>
                <Text style={styles.dashboardTitle}>لسه مفيش حاجة جاية</Text>
                <Text style={styles.dashboardMeta}>أول تذكير هيتحط هنا.</Text>
              </View>
            )}
          </Pressable>

        </View>

        {pendingParse ? (
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={pauseAutoConfirm} />
            <Animated.View
              style={[
                styles.confirmCard,
                {
                  opacity: confirmOpacity,
                  transform: [{ scale: confirmScale }],
                },
              ]}
            >
              <Pressable onPress={pauseAutoConfirm} style={styles.confirmCardInner}>
                <Text style={styles.confirmTitle}>تمام كده؟ 👻</Text>
                {confirmEditing ? (
                  <>
                    <TextInput
                      value={pendingParse.draft.title}
                      onChangeText={(value) =>
                        setPendingParse((current) =>
                          current
                            ? {
                                ...current,
                                draft: {
                                  ...current.draft,
                                  title: value,
                                },
                              }
                            : current
                        )
                      }
                      onFocus={pauseAutoConfirm}
                      placeholder="اسم المهمة"
                      placeholderTextColor={colors.textMuted}
                      style={styles.confirmInput}
                      textAlign="right"
                    />

                    <Text style={styles.confirmMeta}>
                      {toArabicDateTimeLabel(pendingParse.draft.eventAt)}
                    </Text>

                    <View style={styles.confirmOffsetRow}>
                      {quickOffsetOptions.map((value) => (
                        <Pressable
                          key={value}
                          onPress={() => {
                            pauseAutoConfirm();
                            setPendingParse((current) =>
                              current
                                ? {
                                    ...current,
                                    draft: {
                                      ...current.draft,
                                      offsetMinutes: value,
                                    },
                                  }
                                : current
                            );
                          }}
                          style={[
                            styles.confirmOffsetChip,
                            value === pendingParse.draft.offsetMinutes &&
                              styles.confirmOffsetChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.confirmOffsetText,
                              value === pendingParse.draft.offsetMinutes &&
                                styles.confirmOffsetTextActive,
                            ]}
                          >
                            {relativeReminderLabel(value)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.confirmValue}>{pendingParse.draft.title}</Text>
                    <Text style={styles.confirmMeta}>
                      {toArabicDateTimeLabel(pendingParse.draft.eventAt)}
                    </Text>
                    <Text style={styles.confirmMeta}>
                      {relativeReminderLabel(pendingParse.draft.offsetMinutes)}
                    </Text>
                  </>
                )}

                <View style={styles.confirmActions}>
                  <Pressable
                    onPress={() => {
                      if (confirmEditing) {
                        openFullConfirmation(pendingParse);
                        return;
                      }

                      enableInlineEdit();
                    }}
                    style={styles.confirmAction}
                  >
                    <Text style={styles.confirmActionSecondaryText}>
                      {confirmEditing ? 'تعديل أكتر' : 'تعديل'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void confirmPendingParse(pendingParse);
                    }}
                    style={[styles.confirmAction, styles.confirmActionPrimary]}
                  >
                    <Text style={styles.confirmActionPrimaryText}>تم</Text>
                  </Pressable>
                </View>

                <View style={styles.confirmProgressTrack}>
                  <Animated.View
                    style={[
                      styles.confirmProgressBar,
                      {
                        width: confirmProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>

                <Text style={styles.confirmHint}>
                  {confirmEditing
                    ? 'عدّل بسرعة واضغط تم.'
                    : confirmPaused
                      ? 'العد التلقائي وقف. راجع براحتك.'
                      : 'هيتحفظ تلقائيًا خلال ٣ ثواني'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}

        {toastMessage ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
            {toastShareText ? (
              <Pressable
                onPress={() => {
                  void Share.share({ message: toastShareText });
                }}
                style={styles.toastShare}
              >
                <Text style={styles.toastShareText}>شارك</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -120,
    left: -30,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: -120,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0,229,168,0.08)',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: spacing.md,
    gap: 12,
  },
  hero: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
    flexShrink: 0,
  },
  heroCompact: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  heroGlowTop: {
    position: 'absolute',
    top: -35,
    right: -15,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,229,168,0.14)',
  },
  heroGlass: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  navButton: {
    alignItems: 'center',
    gap: 6,
  },
  navIconShell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  navLabel: {
    fontFamily: fonts.semibold,
    color: colors.primaryDark,
    fontSize: 10,
    writingDirection: 'rtl',
  },
  heroCopy: {
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  heroTopRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  statusText: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.white,
    textAlign: 'right',
    lineHeight: 34,
    writingDirection: 'rtl',
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.84)',
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  localePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  localeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  localeHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.white,
    writingDirection: 'rtl',
  },
  micStage: {
    marginTop: -42,
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  micStageCompact: {
    marginTop: -36,
  },
  micGlow: {
    position: 'absolute',
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: 'rgba(0,229,168,0.22)',
  },
  micWrap: {
    alignItems: 'center',
    marginTop: 2,
  },
  micRingOuter: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(108,92,231,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micRingOuterCompact: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  micRingInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.08)',
  },
  micRingInnerCompact: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 30,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  micButtonCompact: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  stopSquare: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  micHint: {
    textAlign: 'center',
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 17,
    writingDirection: 'rtl',
  },
  micHintCompact: {
    fontSize: 15,
  },
  micSubhint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  micSubhintCompact: {
    fontSize: 11,
    lineHeight: 16,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    height: 26,
    marginTop: 2,
  },
  waveBar: {
    width: 6,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  processingSpinner: {
    marginTop: spacing.xs,
  },
  transcriptBox: {
    minHeight: 88,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    justifyContent: 'flex-start',
    gap: spacing.xs,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  transcriptBoxCompact: {
    minHeight: 80,
    padding: 12,
  },
  transcriptHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transcriptLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  transcriptLive: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  transcriptText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  transcriptTextCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  transcriptRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
  },
  transcriptBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  transcriptBadgeBusy: {
    backgroundColor: 'rgba(108,92,231,0.1)',
  },
  ghostBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  ghostShape: {
    width: 28,
    height: 30,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 7,
  },
  ghostEyes: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  ghostEye: {
    width: 4,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryDark,
  },
  ghostSmile: {
    width: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(76,63,207,0.45)',
  },
  ghostTailRow: {
    position: 'absolute',
    bottom: -2,
    flexDirection: 'row',
    gap: 1,
  },
  ghostTail: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  ghostTailCenter: {
    transform: [{ translateY: 2 }],
  },
  ghostSpark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  transcriptCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  transcriptEmptyTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  transcriptEmptyMeta: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summaryBlock: {
    gap: 4,
    alignItems: 'flex-end',
    minHeight: 52,
  },
  summaryMeta: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  feedbackCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(199,75,67,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    textAlign: 'right',
    lineHeight: 20,
    fontSize: 12,
    writingDirection: 'rtl',
    flex: 1,
  },
  feedbackAction: {
    backgroundColor: colors.cardMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  feedbackActionText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    color: colors.warning,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  warningAction: {
    backgroundColor: 'rgba(154,107,0,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  warningActionText: {
    color: colors.warning,
    fontFamily: fonts.bold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(23,19,41,0.16)',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '88%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 6,
  },
  confirmCardInner: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  confirmTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 28,
  },
  confirmInput: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(247,247,251,0.9)',
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmMeta: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  confirmOffsetRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  confirmOffsetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(108,92,231,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.08)',
  },
  confirmOffsetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  confirmOffsetText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  confirmOffsetTextActive: {
    color: colors.white,
  },
  confirmActions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  confirmActionPrimary: {
    backgroundColor: colors.primary,
  },
  confirmActionPrimaryText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 15,
    writingDirection: 'rtl',
  },
  confirmActionSecondaryText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
    writingDirection: 'rtl',
  },
  confirmProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(108,92,231,0.12)',
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  confirmProgressBar: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  confirmHint: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  toast: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '88%',
  },
  toastText: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  toastShare: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  toastShareText: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  bottomStack: {
    flexDirection: 'column',
    gap: spacing.sm,
    minHeight: 0,
    marginTop: 2,
  },
  dashboardCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    justifyContent: 'flex-start',
    minHeight: 0,
  },
  recentCard: {
    minHeight: 132,
    gap: spacing.xs,
    backgroundColor: colors.card,
  },
  dashboardBody: {
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  dashboardEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  dashboardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dashboardLink: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  categoryPill: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  categoryPillText: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  dashboardTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  dashboardMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  nextMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  nextMetaBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nextMetaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  nextMetaText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  nextEmptyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextEmptyIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(108,92,231,0.35)',
  },
});

const micGlyphStyles = StyleSheet.create({
  container: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    width: 24,
    height: 30,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.white,
  },
  stem: {
    width: 3,
    height: 12,
    backgroundColor: colors.white,
    marginTop: 4,
    borderRadius: 2,
  },
  base: {
    width: 22,
    height: 3,
    backgroundColor: colors.white,
    marginTop: 4,
    borderRadius: 2,
  },
});

const navGlyphStyles = StyleSheet.create({
  listWrap: {
    gap: 3,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryDark,
  },
  listLine: {
    width: 14,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.primaryDark,
  },
  gearWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primaryDark,
  },
  gearTooth: {
    position: 'absolute',
    width: 3,
    height: 6,
    borderRadius: 2,
    backgroundColor: colors.primaryDark,
  },
  toothTop: {
    top: 0,
  },
  toothBottom: {
    bottom: 0,
  },
  toothLeft: {
    left: 0,
    transform: [{ rotate: '90deg' }],
  },
  toothRight: {
    right: 0,
    transform: [{ rotate: '90deg' }],
  },
});
