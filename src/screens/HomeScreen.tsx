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
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import {
  buildReminderAnalyticsProperties,
  getCalendarMode,
  track,
} from '../services/analytics';
import { colors, fonts, radii, spacing } from '../theme';
import { ReminderDraft, RootStackParamList } from '../types';
import { parseReminderText } from '../utils/parser';
import { getReminderCategoryLabel } from '../utils/categorization';
import { buildGhostReply } from '../utils/ghostPersonality';
import {
  toArabicDateLabel,
  toArabicTimeLabel,
  relativeReminderLabel,
  toArabicDateTimeLabel,
} from '../utils/arabic';
import {
  getNextDueReminder,
  getOverdueReminderCount,
  getReminderTimelineSnapshot,
} from '../utils/reminders';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type PendingParse = {
  draft: ReminderDraft;
  transcript: string;
  confidence: number;
  missingFields: string[];
  parseSource?: string;
  requiresManualConfirmation: boolean;
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
const preferredEnglishLocales = ['en-US', 'en-GB', 'en'];

function getSpeechLocaleLabel(locale: string, language: 'ar-EG' | 'en' = 'ar-EG') {
  if (locale.toLowerCase().startsWith('ar')) {
    return language === 'en' ? 'Arabic' : 'مصري';
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

function pickEnglishLocale(locales: string[]) {
  const uniqueLocales = Array.from(new Set(locales));

  for (const preferred of preferredEnglishLocales) {
    const directMatch = uniqueLocales.find(
      (locale) => locale.toLowerCase() === preferred.toLowerCase()
    );
    if (directMatch) {
      return directMatch;
    }
  }

  return uniqueLocales.find((locale) => locale.toLowerCase().startsWith('en'));
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
  const copy = getAppCopy(settings.uiLanguage);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speechLocale, setSpeechLocale] = useState('ar-EG');
  const [pendingParse, setPendingParse] = useState<PendingParse | null>(null);
  const [confirmPaused, setConfirmPaused] = useState(false);
  const [showPickerMode, setShowPickerMode] = useState<'date' | 'time' | null>(null);
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
  const { height } = useWindowDimensions();
  const compact = height < 780;
  const notificationActionLabel =
    notificationPermission === 'blocked'
      ? copy.settings.notificationActionBlocked
      : copy.settings.notificationActionAsk;
  const isHighConfidenceCard = Boolean(
    pendingParse &&
      pendingParse.confidence >= 0.9 &&
      pendingParse.missingFields.length === 0 &&
      !pendingParse.requiresManualConfirmation
  );

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setErrorMessage('');
    setProcessing(false);
    setPendingParse(null);
    track('voice listening started', {
      source: 'home',
      speech_locale: speechLocale,
    });
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setBusy(false);

    if (!shouldProcessOnEndRef.current) {
      return;
    }

    shouldProcessOnEndRef.current = false;
    const sourceTranscript = transcriptRef.current.trim();
    track('voice listening ended', {
      source: 'home',
      speech_locale: speechLocale,
      had_transcript: Boolean(sourceTranscript),
    });
    if (!sourceTranscript) {
      setErrorMessage(copy.home.voiceEmpty);
      return;
    }

    track('voice transcript captured', {
      source: 'home',
      speech_locale: speechLocale,
      transcript_length_bucket:
        sourceTranscript.length > 80
          ? 'long'
          : sourceTranscript.length > 30
            ? 'medium'
            : 'short',
    });

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
      setShowPickerMode(null);
      if (autoConfirmTimeoutRef.current) {
        clearTimeout(autoConfirmTimeoutRef.current);
        autoConfirmTimeoutRef.current = null;
      }
      return;
    }

    setConfirmPaused(false);
    confirmOpacity.setValue(0);
    confirmScale.setValue(0.95);
    confirmProgress.setValue(1);
    track('reminder confirmation shown', {
      entry_point: 'voice_home',
      confirmation_mode: 'inline',
      confidence_state:
        pendingParse.confidence >= 0.9 &&
        pendingParse.missingFields.length === 0 &&
        !pendingParse.requiresManualConfirmation
          ? 'high'
          : 'low',
        ...buildReminderAnalyticsProperties({
          draft: pendingParse.draft,
          entryPoint: 'voice_home',
          isVoiceFlow: true,
          notificationPermissionState: notificationPermission,
          calendarMode: getCalendarMode({ settings }),
          parseConfidence: pendingParse.confidence,
          parseSource: pendingParse.parseSource,
          missingFields: pendingParse.missingFields,
          confirmationMode: 'inline',
        }),
    });

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
    ]).start();

    if (
      pendingParse.confidence >= 0.9 &&
      pendingParse.missingFields.length === 0 &&
      !pendingParse.requiresManualConfirmation
    ) {
      track('reminder inline auto-save triggered', {
        entry_point: 'voice_home',
        confirmation_mode: 'auto',
        confidence_state: 'high',
        ...buildReminderAnalyticsProperties({
          draft: pendingParse.draft,
          entryPoint: 'voice_home',
          isVoiceFlow: true,
          notificationPermissionState: notificationPermission,
          calendarMode: getCalendarMode({ settings }),
          parseConfidence: pendingParse.confidence,
          parseSource: pendingParse.parseSource,
          missingFields: pendingParse.missingFields,
          confirmationMode: 'auto',
        }),
      });

      Animated.timing(confirmProgress, {
        toValue: 0,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      autoConfirmTimeoutRef.current = setTimeout(() => {
        const current = latestPendingParseRef.current;
        if (!current) {
          return;
        }

        void confirmPendingParse(current);
      }, 3000);
    }

    return () => {
      if (autoConfirmTimeoutRef.current) {
        clearTimeout(autoConfirmTimeoutRef.current);
        autoConfirmTimeoutRef.current = null;
      }
      confirmProgress.stopAnimation();
    };
  }, [
    pendingParse,
    confirmOpacity,
    confirmProgress,
    confirmScale,
    notificationPermission,
    settings,
  ]);

  const nextDueReminder = getNextDueReminder(reminders);
  const overdueCount = getOverdueReminderCount(reminders);
  const transcriptPreview = pendingParse
    ? pendingParse.draft.title
    : processing
      ? settings.uiLanguage === 'en'
        ? 'Turning your words into a clear reminder...'
        : 'بنحوّل كلامك إلى تذكير واضح...'
      : transcript.trim();
  const voiceStateLabel = processing
    ? settings.uiLanguage === 'en'
      ? 'Parsing'
      : 'بنفهمها'
    : isListening
      ? settings.uiLanguage === 'en'
        ? 'Listening'
        : 'سامعك'
      : pendingParse
        ? settings.uiLanguage === 'en'
          ? 'Review'
          : 'راجع بسرعة'
        : settings.uiLanguage === 'en'
          ? 'Ready'
          : 'جاهز';

  function buildDraftFromParse(parsed: Awaited<ReturnType<typeof parseReminderText>>) {
    const normalizedTitle =
      settings.uiLanguage === 'en' && parsed.title === 'تذكير جديد'
        ? 'New reminder'
        : parsed.title;

    return {
      title: normalizedTitle,
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

  function validateDraft(draft: ReminderDraft) {
    if (!draft.title.trim()) {
      return settings.uiLanguage === 'en'
        ? 'The task name still needs a clearer title.'
        : 'اسم المهمة محتاج يتظبط.';
    }

    const remindAt = dayjs(draft.eventAt).subtract(draft.offsetMinutes, 'minute');
    if (draft.recurrence === 'none' && remindAt.isBefore(dayjs().add(1, 'minute'))) {
      return settings.uiLanguage === 'en' ? 'Please review the time.' : 'راجع الوقت بس.';
    }

    return '';
  }

  function openInlinePicker(mode: 'date' | 'time') {
    pauseAutoConfirm();
    setShowPickerMode(mode);
  }

  function handleInlineDateTimeChange(
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) {
    if (Platform.OS !== 'ios') {
      setShowPickerMode(null);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setPendingParse((current) => {
      if (!current) {
        return current;
      }

      const currentEventAt = dayjs(current.draft.eventAt);
      const nextEventAt =
        showPickerMode === 'date'
          ? currentEventAt
              .year(selectedDate.getFullYear())
              .month(selectedDate.getMonth())
              .date(selectedDate.getDate())
              .second(0)
              .millisecond(0)
          : currentEventAt
              .hour(selectedDate.getHours())
              .minute(selectedDate.getMinutes())
              .second(0)
              .millisecond(0);

      return {
        ...current,
        draft: {
          ...current.draft,
          eventAt: nextEventAt.toISOString(),
        },
        missingFields: current.missingFields.filter((field) =>
          field !== (showPickerMode === 'date' ? 'date' : 'time')
        ),
        requiresManualConfirmation: true,
      };
    });
  }

  function pauseAutoConfirm() {
    if (!pendingParse || confirmPaused || !isHighConfidenceCard) {
      return;
    }

    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }

    confirmProgress.stopAnimation();
    setConfirmPaused(true);
  }

  async function confirmPendingParse(target: PendingParse) {
    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }

    await saveDraft(target.draft, target.transcript, {
      confirmationMode: 'inline',
      parseConfidence: target.confidence,
      parseSource: target.parseSource,
      missingFields: target.missingFields,
    });
  }

  async function processCapturedTranscript(sourceTranscript: string) {
    try {
      setProcessing(true);
      const parsed = await parseReminderText(sourceTranscript);
      const draft = buildDraftFromParse(parsed);
      track('reminder parse succeeded', {
        entry_point: 'voice_home',
        ...buildReminderAnalyticsProperties({
          draft,
          entryPoint: 'voice_home',
          isVoiceFlow: true,
          notificationPermissionState: notificationPermission,
          calendarMode: getCalendarMode({ settings }),
          parseConfidence: parsed.confidence,
          parseSource: parsed.source,
          missingFields: parsed.missingFields,
        }),
      });

      const nextPending = {
        draft,
        transcript: sourceTranscript,
        confidence: parsed.confidence,
        missingFields: parsed.missingFields,
        parseSource: parsed.source,
        requiresManualConfirmation:
          parsed.confidence < 0.9 || parsed.missingFields.length > 0,
      } satisfies PendingParse;

      setPendingParse(nextPending);
      setErrorMessage('');
    } catch {
      track('reminder parse failed', {
        entry_point: 'voice_home',
        is_voice_flow: true,
        reason: 'parser_exception',
      });
      setErrorMessage(copy.home.parseFailure);
    } finally {
      setProcessing(false);
    }
  }

  async function saveDraft(
    draft: ReminderDraft,
    sourceTranscript: string,
    options?: {
      confirmationMode?: 'auto' | 'inline';
      parseConfidence?: number;
      parseSource?: string;
      missingFields?: string[];
    }
  ) {
    const validationIssue = validateDraft(draft);
    if (validationIssue) {
      track('reminder create failed', {
        entry_point: 'voice_home',
        ...buildReminderAnalyticsProperties({
          draft,
          entryPoint: 'voice_home',
          isVoiceFlow: true,
          notificationPermissionState: notificationPermission,
          calendarMode: getCalendarMode({ settings }),
          parseConfidence: options?.parseConfidence,
          parseSource: options?.parseSource,
          missingFields: options?.missingFields,
          confirmationMode: options?.confirmationMode,
          resultReason: validationIssue,
        }),
      });
      setErrorMessage(validationIssue);
      return;
    }

    const result = await createReminder(draft, sourceTranscript);
    if (!result.ok) {
      track('reminder create failed', {
        entry_point: 'voice_home',
        ...buildReminderAnalyticsProperties({
          draft,
          entryPoint: 'voice_home',
          isVoiceFlow: true,
          notificationPermissionState: notificationPermission,
          calendarMode: getCalendarMode({ settings }),
          parseConfidence: options?.parseConfidence,
          parseSource: options?.parseSource,
          missingFields: options?.missingFields,
          confirmationMode: options?.confirmationMode,
          resultReason: result.reason,
        }),
      });
      setErrorMessage(result.reason ?? copy.home.saveFailure);
      return;
    }

    track('reminder create succeeded', {
      entry_point: 'voice_home',
      notification_status: result.warning ? 'warning' : 'ok',
      ...buildReminderAnalyticsProperties({
        draft,
        entryPoint: 'voice_home',
        isVoiceFlow: true,
        notificationPermissionState: notificationPermission,
        calendarMode: getCalendarMode({ settings }),
        parseConfidence: options?.parseConfidence,
        parseSource: options?.parseSource,
        missingFields: options?.missingFields,
        confirmationMode: options?.confirmationMode,
      }),
    });

    setPendingParse(null);
    setTranscript('');
    setErrorMessage('');
    const reply = buildGhostReply({
      mode: settings.ghostMode,
      title: draft.title,
      category: draft.category,
      recurrence: draft.recurrence,
      language: settings.uiLanguage,
    });
    setToastMessage(result.warning ?? reply);
    setToastShareText(
      result.warning
        ? ''
        : settings.uiLanguage === 'en'
          ? ['VoiceGhost 👻', '', `You said: ${sourceTranscript}`, `Ghost reply: ${reply}`].join(
              '\n'
            )
          : ['VoiceGhost 👻', '', `قلت: ${sourceTranscript}`, `الجوست رد: ${reply}`].join('\n')
    );
  }

  async function handleNotificationAction() {
    if (notificationPermission === 'blocked') {
      await openNotificationSettings();
      return;
    }

    await requestNotificationAccess('home_banner');
  }

  async function resolveSpeechLocale() {
    try {
      const supported = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      const availableLocales = [...supported.installedLocales, ...supported.locales];

      if (!availableLocales.length) {
        return settings.uiLanguage === 'en' ? 'en-US' : 'ar-EG';
      }

      if (settings.uiLanguage === 'en') {
        const englishLocale = pickEnglishLocale(availableLocales);
        if (englishLocale) {
          return englishLocale;
        }
      } else {
        const arabicLocale = pickArabicLocale(availableLocales);
        if (arabicLocale) {
          return arabicLocale;
        }
      }

      const fallbackLocale =
        settings.uiLanguage === 'en'
          ? pickEnglishLocale(availableLocales)
          : pickArabicLocale(availableLocales);

      return fallbackLocale ?? null;
    } catch {
      return settings.uiLanguage === 'en' ? 'en-US' : 'ar-EG';
    }
  }

  async function toggleRecording() {
    if (processing) {
      return;
    }

    track('microphone tapped', {
      source: 'home',
      action: isListening ? 'stop' : 'start',
    });

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
      setErrorMessage(copy.home.speechPermissionNeeded);
      return;
    }

    const resolvedLocale = await resolveSpeechLocale();
    if (!resolvedLocale) {
      setBusy(false);
      setProcessing(false);
      shouldProcessOnEndRef.current = false;
      setErrorMessage(
        Platform.OS === 'ios'
          ? copy.home.enableArabicIos
          : copy.home.arabicUnavailable
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
        <View style={styles.voiceTopBar}>
          <NavIconButton
            label={copy.common.settings}
            onPress={() => navigation.navigate('Settings')}
            variant="settings"
            showLabel={false}
          />
          <View style={styles.voiceBrand}>
            <Text style={styles.voiceBrandTitle}>VoiceGhost</Text>
            <Text style={styles.voiceBrandSubtitle}>{copy.home.brandSubtitle}</Text>
          </View>
          <NavIconButton
            label={copy.common.reminders}
            onPress={() => navigation.navigate('ReminderList')}
            variant="reminders"
            showLabel={false}
          />
        </View>

        {pendingPermissionReminders > 0 ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>
              {pendingPermissionReminders === 1
                ? copy.home.pendingOne
                : copy.home.pendingMany(pendingPermissionReminders)}
            </Text>
            <Pressable
              onPress={() => void handleNotificationAction()}
              style={styles.statusBannerAction}
            >
              <Text style={styles.statusBannerActionText}>{notificationActionLabel}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.voiceCenter}>
          <Text style={styles.voiceTitle}>
            {processing ? copy.home.voiceTitleProcessing : copy.home.voiceTitleIdle}
          </Text>
          <Text style={styles.voiceSubtitle}>
            {isListening
              ? copy.home.voiceSubtitleListening
              : pendingParse
                ? copy.home.voiceSubtitlePending
                : copy.home.voiceSubtitleIdle}
          </Text>

          <View style={[styles.voiceStatePill, busy && styles.voiceStatePillActive]}>
            <View style={styles.voiceStateDot} />
            <Text style={styles.voiceStateText}>{voiceStateLabel}</Text>
          </View>

          <View style={[styles.micStage, compact && styles.micStageCompact, styles.voiceMicStage]}>
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
              {processing
                ? copy.home.hintProcessing
                : isListening
                  ? copy.home.hintListening
                  : copy.home.hintIdle}
            </Text>
            <Text style={[styles.micSubhint, compact && styles.micSubhintCompact]}>
              {processing
                ? copy.home.subhintProcessing
                : isListening
                  ? copy.home.subhintListening
                  : copy.home.subhintIdle}
            </Text>
            {isListening ? <Waveform pulse={pulse} /> : null}
            {processing ? (
              <ActivityIndicator color={colors.primaryDark} style={styles.processingSpinner} />
            ) : null}
          </View>

          <View style={styles.voiceTranscriptCard}>
            {transcriptPreview ? (
              <Text numberOfLines={2} style={styles.voiceTranscriptText}>
                {transcriptPreview}
              </Text>
            ) : (
              <Text style={styles.voiceTranscriptPlaceholder}>
                {copy.home.transcriptPlaceholder}
              </Text>
            )}
            <Text style={styles.voiceTranscriptMeta}>
              {getSpeechLocaleLabel(speechLocale, settings.uiLanguage)}
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.inlineErrorCard}>
              <Text numberOfLines={2} style={styles.inlineErrorText}>
                {errorMessage}
              </Text>
              {!processing ? (
                <Pressable
                  onPress={() => {
                    setErrorMessage('');
                    void toggleRecording();
                  }}
                  style={styles.inlineErrorAction}
                >
                  <Text style={styles.inlineErrorActionText}>{copy.home.retryVoice}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => navigation.navigate('ReminderList')}
          style={styles.latestReminderCard}
        >
          <View style={styles.latestReminderHeader}>
            <Text style={styles.latestReminderLink}>{copy.common.allReminders}</Text>
            <Text style={styles.latestReminderEyebrow}>{copy.home.nearestNow}</Text>
          </View>

          {nextDueReminder ? (
            <View style={styles.latestReminderBody}>
              <View style={styles.latestReminderTopRow}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {getReminderCategoryLabel(nextDueReminder.category, settings.uiLanguage)}
                  </Text>
                </View>
                {overdueCount > 0 ? (
                  <View style={styles.overduePill}>
                    <Text style={styles.overduePillText}>
                      {overdueCount} {copy.common.overdue}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={2} style={styles.latestReminderTitle}>
                {nextDueReminder.title}
              </Text>
              <Text numberOfLines={1} style={styles.latestReminderMeta}>
                {toArabicDateTimeLabel(
                  getReminderTimelineSnapshot(nextDueReminder).activeReminderAt,
                  settings.uiLanguage
                )}
              </Text>
              <Text numberOfLines={1} style={styles.latestReminderMeta}>
                {copy.home.latestPinnedText}
              </Text>
            </View>
          ) : (
            <View style={styles.latestReminderEmpty}>
              <GhostIllustration />
              <View style={styles.latestReminderEmptyCopy}>
                <Text style={styles.latestReminderTitle}>{copy.home.latestEmptyTitle}</Text>
                <Text style={styles.latestReminderMeta}>
                  {copy.home.latestEmptyText}
                </Text>
              </View>
            </View>
          )}
        </Pressable>

        {pendingParse ? (
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={pauseAutoConfirm} />
            <Animated.View
              style={[
                styles.confirmCard,
                !isHighConfidenceCard && styles.confirmCardWarning,
                {
                  opacity: confirmOpacity,
                  transform: [{ scale: confirmScale }],
                },
              ]}
            >
              <Pressable onPress={pauseAutoConfirm} style={styles.confirmCardInner}>
                <View
                  style={[
                    styles.confirmStateBadge,
                    !isHighConfidenceCard && styles.confirmStateBadgeWarning,
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmStateBadgeText,
                      !isHighConfidenceCard && styles.confirmStateBadgeTextWarning,
                    ]}
                  >
                    {isHighConfidenceCard ? copy.home.confirmReady : copy.home.confirmReview}
                  </Text>
                </View>
                <Text style={styles.confirmTitle}>{copy.home.confirmTitle}</Text>
                <Text style={styles.confirmValue}>{pendingParse.draft.title}</Text>

                {!isHighConfidenceCard ? (
                  <Text style={styles.confirmWarningText}>
                    {copy.home.confirmWarning}
                  </Text>
                ) : null}

                <View style={styles.confirmDetailGrid}>
                  <Pressable
                    onPress={() => openInlinePicker('date')}
                    style={[
                      styles.confirmDetailCard,
                      showPickerMode === 'date' && styles.confirmDetailCardActive,
                      pendingParse.missingFields.includes('date') &&
                        styles.confirmDetailCardWarning,
                    ]}
                  >
                    <View style={styles.confirmDetailText}>
                      <Text style={styles.confirmDetailLabel}>{copy.home.dateLabel}</Text>
                      <Text
                        style={[
                          styles.confirmDetailValue,
                          pendingParse.missingFields.includes('date') &&
                            styles.confirmDetailValueWarning,
                        ]}
                      >
                        {pendingParse.missingFields.includes('date')
                          ? copy.home.setDate
                          : toArabicDateLabel(pendingParse.draft.eventAt, settings.uiLanguage)}
                      </Text>
                    </View>
                    <Text style={styles.confirmDetailAction}>
                      {pendingParse.missingFields.includes('date')
                        ? copy.home.pickDate
                        : copy.common.change}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openInlinePicker('time')}
                    style={[
                      styles.confirmDetailCard,
                      showPickerMode === 'time' && styles.confirmDetailCardActive,
                      pendingParse.missingFields.includes('time') &&
                        styles.confirmDetailCardWarning,
                    ]}
                  >
                    <View style={styles.confirmDetailText}>
                      <Text style={styles.confirmDetailLabel}>{copy.home.timeLabel}</Text>
                      <Text
                        style={[
                          styles.confirmDetailValue,
                          pendingParse.missingFields.includes('time') &&
                            styles.confirmDetailValueWarning,
                        ]}
                      >
                        {pendingParse.missingFields.includes('time')
                          ? copy.home.setTime
                          : toArabicTimeLabel(pendingParse.draft.eventAt, settings.uiLanguage)}
                      </Text>
                    </View>
                    <Text style={styles.confirmDetailAction}>
                      {pendingParse.missingFields.includes('time')
                        ? copy.home.pickTime
                        : copy.common.change}
                    </Text>
                  </Pressable>
                </View>

                {showPickerMode ? (
                  <View style={styles.confirmPickerWrap}>
                    <Text
                      style={[
                        styles.confirmPickerLabel,
                        showPickerMode === 'date' && styles.confirmPickerLabelDate,
                      ]}
                    >
                      {showPickerMode === 'date'
                        ? copy.home.pickerDateTitle
                        : copy.home.pickerTimeTitle}
                    </Text>

                    <DateTimePicker
                      mode={showPickerMode}
                      value={new Date(pendingParse.draft.eventAt)}
                      is24Hour={false}
                      display={
                        Platform.OS === 'ios'
                          ? showPickerMode === 'date'
                            ? 'inline'
                            : 'spinner'
                          : 'default'
                      }
                      onChange={handleInlineDateTimeChange}
                    />
                  </View>
                ) : null}

                <Text style={styles.confirmMeta}>
                  {relativeReminderLabel(pendingParse.draft.offsetMinutes, settings.uiLanguage)}
                </Text>

                {pendingParse.missingFields.length > 0 ? (
                  <View style={styles.confirmWarningRow}>
                    {pendingParse.missingFields.map((field) => (
                      <View key={field} style={styles.confirmWarningChip}>
                        <Text style={styles.confirmWarningChipText}>
                          {field === 'time'
                            ? copy.home.unclearTime
                            : field === 'date'
                              ? copy.home.unclearDate
                              : field === 'title'
                                ? copy.home.unclearTitle
                                : field}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.confirmActions}>
                  <Pressable
                    onPress={() => {
                      pauseAutoConfirm();
                      openFullConfirmation(pendingParse);
                    }}
                    style={styles.confirmAction}
                  >
                    <Text style={styles.confirmActionSecondaryText}>{copy.common.edit}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      pauseAutoConfirm();
                      void confirmPendingParse(pendingParse);
                    }}
                    style={[styles.confirmAction, styles.confirmActionPrimary]}
                  >
                    <Text style={styles.confirmActionPrimaryText}>{copy.common.save}</Text>
                  </Pressable>
                </View>

                {isHighConfidenceCard ? (
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
                ) : null}

                <Text style={styles.confirmHint}>
                  {!isHighConfidenceCard
                    ? copy.home.lowHint
                    : confirmPaused
                      ? copy.home.highHintPaused
                      : copy.home.highHintRunning}
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
                <Text style={styles.toastShareText}>{copy.common.share}</Text>
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
  voiceTopBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  voiceBrand: {
    alignItems: 'center',
    gap: 2,
  },
  voiceBrandTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  voiceBrandSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  statusBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.warning,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  statusBannerAction: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusBannerActionText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.warning,
    writingDirection: 'rtl',
  },
  voiceCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  voiceTitle: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  voiceSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    writingDirection: 'rtl',
    maxWidth: 280,
  },
  voiceStatePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
  },
  voiceStatePillActive: {
    borderColor: 'rgba(108,92,231,0.26)',
  },
  voiceStateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  voiceStateText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  voiceMicStage: {
    marginTop: 0,
    gap: spacing.xs,
  },
  voiceTranscriptCard: {
    width: '100%',
    maxWidth: 340,
    minHeight: 78,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    shadowColor: colors.shadow,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  voiceTranscriptText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    writingDirection: 'rtl',
  },
  voiceTranscriptPlaceholder: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    writingDirection: 'rtl',
  },
  voiceTranscriptMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primaryDark,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  inlineErrorCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF1EF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#F3D3CF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  inlineErrorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  inlineErrorAction: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#F3D3CF',
  },
  inlineErrorActionText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.danger,
    writingDirection: 'rtl',
  },
  latestReminderCard: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  latestReminderHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  latestReminderLink: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  latestReminderEyebrow: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  latestReminderBody: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  latestReminderTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  latestReminderTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  latestReminderMeta: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  latestReminderEmpty: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
  latestReminderEmptyCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  overduePill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  overduePillText: {
    color: '#B91C1C',
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
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
    zIndex: 1,
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
    backgroundColor: 'rgba(23,19,41,0.34)',
    padding: spacing.lg,
    zIndex: 40,
    elevation: 20,
  },
  confirmCard: {
    width: '90%',
    maxWidth: 372,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(228,226,244,0.92)',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 22 },
    elevation: 16,
    overflow: 'hidden',
    zIndex: 41,
  },
  confirmCardWarning: {
    backgroundColor: '#FFFCF4',
    borderColor: '#F2D58C',
  },
  confirmCardInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  confirmStateBadge: {
    alignSelf: 'flex-end',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  confirmStateBadgeWarning: {
    backgroundColor: '#FFF2C7',
  },
  confirmStateBadgeText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  confirmStateBadgeTextWarning: {
    color: '#9A6700',
  },
  confirmTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 26,
  },
  confirmWarningText: {
    color: '#9A6700',
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  confirmDetailGrid: {
    gap: spacing.sm,
  },
  confirmDetailCard: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(108,92,231,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.08)',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmDetailCardActive: {
    borderColor: 'rgba(108,92,231,0.26)',
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  confirmDetailCardWarning: {
    backgroundColor: '#FFF6DA',
    borderColor: '#F6D88A',
  },
  confirmDetailText: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-end',
  },
  confirmDetailLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmDetailValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  confirmDetailValueWarning: {
    color: '#9A6700',
  },
  confirmDetailAction: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 12,
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
  confirmPickerWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  confirmPickerLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  confirmPickerLabelDate: {
    paddingBottom: spacing.xs,
  },
  confirmWarningRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: -2,
  },
  confirmWarningChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: '#FFF2C7',
    borderWidth: 1,
    borderColor: '#F6D88A',
  },
  confirmWarningChipText: {
    color: '#9A6700',
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  confirmActions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmAction: {
    flex: 1,
    minHeight: 48,
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
