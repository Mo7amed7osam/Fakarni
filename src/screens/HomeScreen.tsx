import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassSurface } from '../components/GlassSurface';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import {
  buildReminderAnalyticsProperties,
  getCalendarMode,
  track,
} from '../services/analytics';
import { colors, fonts, radii, spacing } from '../theme';
import {
  ParseLLMReason,
  ParseModelTier,
  ParsePath,
  Reminder,
  ReminderDraft,
  RootStackParamList,
} from '../types';
import { parseReminderText } from '../utils/parser';
import { getReminderCategoryLabel } from '../utils/categorization';
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
  parsePath?: ParsePath;
  llmReason?: ParseLLMReason;
  cacheHit?: boolean;
  modelTier?: ParseModelTier;
  requiresManualConfirmation: boolean;
};

type UndoAction =
  | { kind: 'remove_created'; reminderId: string }
  | { kind: 'restore_snapshot'; reminder: Reminder };

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
  const teeth = [
    'toothTop',
    'toothBottom',
    'toothLeft',
    'toothRight',
    'toothTopLeft',
    'toothTopRight',
    'toothBottomLeft',
    'toothBottomRight',
  ] as const;

  return (
    <View style={navGlyphStyles.gearWrap}>
      {teeth.map((tooth) => (
        <View key={tooth} style={[navGlyphStyles.gearTooth, navGlyphStyles[tooth]]} />
      ))}
      <View style={navGlyphStyles.gearRing} />
      <View style={navGlyphStyles.gearCenter} />
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
      <GlassSurface
        style={styles.navIconShell}
        intensity={36}
        overlayColor="rgba(255,255,255,0.26)"
        borderColor="rgba(255,255,255,0.54)"
      >
        {variant === 'settings' ? <SettingsGlyph /> : <RemindersGlyph />}
      </GlassSurface>
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
    removeReminder,
    restoreReminder,
    completeReminder,
    snoozeReminder,
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
  const [confirmNeedsReview, setConfirmNeedsReview] = useState(false);
  const [showPickerMode, setShowPickerMode] = useState<'date' | 'time' | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'warning'>('success');
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
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
  const now = dayjs();
  const appleCalendarNeedsAttention =
    Platform.OS === 'ios' &&
    (settings.appleCalendar.permissionStatus === 'denied' ||
      settings.appleCalendar.permissionStatus === 'restricted');
  const googleCalendarNeedsAttention =
    Platform.OS === 'android' &&
    !settings.googleCalendar.connected &&
    reminders.some(
      (reminder) =>
        reminder.calendarProvider === 'google' ||
        reminder.calendarSyncStatus === 'failed'
    );
  const isHighConfidenceCard = Boolean(
    pendingParse &&
      pendingParse.confidence >= 0.9 &&
      pendingParse.missingFields.length === 0 &&
      !pendingParse.requiresManualConfirmation &&
      !confirmNeedsReview
  );
  const examplePrompts = [copy.home.exampleOne, copy.home.exampleTwo];
  const activeExample = examplePrompts[exampleIndex % examplePrompts.length];

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
      setUndoAction(null);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    const interval = setInterval(() => {
      setExampleIndex((current) => current + 1);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

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
      setConfirmNeedsReview(false);
      setShowPickerMode(null);
      if (autoConfirmTimeoutRef.current) {
        clearTimeout(autoConfirmTimeoutRef.current);
        autoConfirmTimeoutRef.current = null;
      }
      return;
    }

    setConfirmPaused(false);
    setConfirmNeedsReview(false);
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
          parsePath: pendingParse.parsePath,
          llmReason: pendingParse.llmReason,
          cacheHit: pendingParse.cacheHit,
          modelTier: pendingParse.modelTier,
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
          parsePath: pendingParse.parsePath,
          llmReason: pendingParse.llmReason,
          cacheHit: pendingParse.cacheHit,
          modelTier: pendingParse.modelTier,
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
  const urgentReminder = reminders.find((reminder) => {
    const snapshot = getReminderTimelineSnapshot(reminder, now);
    return (
      snapshot.bucket !== 'done' &&
      dayjs(snapshot.activeReminderAt).isBefore(now.add(1, 'minute'))
    );
  });
  const urgentReminderSnapshot = urgentReminder
    ? getReminderTimelineSnapshot(urgentReminder, now)
    : null;
  const showVoiceStatePill = Boolean(isListening || processing || pendingParse || busy);
  const showTranscriptCard = Boolean(pendingParse || processing || transcript.trim());
  const showNextReminderCard = !urgentReminder && Boolean(nextDueReminder || overdueCount > 0);
  const reminderTimingLabel =
    settings.uiLanguage === 'en' ? 'Reminder timing' : 'موعد التنبيه';
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
  const permissionHealth =
    notificationPermission !== 'granted'
      ? {
          title: copy.home.trustStripNotificationsTitle,
          body:
            pendingPermissionReminders > 0
              ? pendingPermissionReminders === 1
                ? copy.home.pendingOne
                : copy.home.pendingMany(pendingPermissionReminders)
              : copy.home.trustStripNotificationsBody,
          actionLabel:
            notificationPermission === 'blocked'
              ? copy.home.trustStripOpenSettings
              : copy.home.trustStripEnableNotifications,
          onPress: handleNotificationAction,
        }
      : appleCalendarNeedsAttention
        ? {
            title: copy.home.trustStripCalendarTitle,
            body: copy.home.trustStripCalendarBody,
            actionLabel: copy.home.trustStripOpenSettings,
            onPress: openNotificationSettings,
          }
        : googleCalendarNeedsAttention
          ? {
              title: copy.home.trustStripGoogleCalendarTitle,
              body: copy.home.trustStripGoogleCalendarBody,
              actionLabel: copy.home.trustStripOpenSettings,
              onPress: () => navigation.navigate('Settings'),
            }
          : null;

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

  function downgradeInlineConfirmationToReview() {
    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }

    confirmProgress.stopAnimation();
    setConfirmPaused(true);
    setConfirmNeedsReview(true);
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
    setConfirmNeedsReview(true);
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
      parsePath: target.parsePath,
      llmReason: target.llmReason,
      cacheHit: target.cacheHit,
      modelTier: target.modelTier,
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
          parsePath: parsed.parsePath,
          llmReason: parsed.llmReason,
          cacheHit: parsed.cacheHit,
          modelTier: parsed.modelTier,
          missingFields: parsed.missingFields,
        }),
        llm_used: Boolean(parsed.llmUsed),
      });

      const nextPending = {
        draft,
        transcript: sourceTranscript,
        confidence: parsed.confidence,
        missingFields: parsed.missingFields,
        parseSource: parsed.source,
        parsePath: parsed.parsePath,
        llmReason: parsed.llmReason,
        cacheHit: parsed.cacheHit,
        modelTier: parsed.modelTier,
        requiresManualConfirmation:
          parsed.confidence < 0.9 || parsed.missingFields.length > 0,
      } satisfies PendingParse;

      setPendingParse(nextPending);
      setConfirmNeedsReview(false);
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
      parsePath?: ParsePath;
      llmReason?: ParseLLMReason;
      cacheHit?: boolean;
      modelTier?: ParseModelTier;
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
          parsePath: options?.parsePath,
          llmReason: options?.llmReason,
          cacheHit: options?.cacheHit,
          modelTier: options?.modelTier,
          missingFields: options?.missingFields,
          confirmationMode: options?.confirmationMode,
          resultReason: validationIssue,
        }),
      });
      downgradeInlineConfirmationToReview();
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
          parsePath: options?.parsePath,
          llmReason: options?.llmReason,
          cacheHit: options?.cacheHit,
          modelTier: options?.modelTier,
          missingFields: options?.missingFields,
          confirmationMode: options?.confirmationMode,
          resultReason: result.reason,
        }),
      });
      downgradeInlineConfirmationToReview();
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
        parsePath: options?.parsePath,
        llmReason: options?.llmReason,
        cacheHit: options?.cacheHit,
        modelTier: options?.modelTier,
        missingFields: options?.missingFields,
        confirmationMode: options?.confirmationMode,
      }),
      save_without_edit: options?.confirmationMode === 'inline',
    });

    setPendingParse(null);
    setTranscript('');
    setErrorMessage('');
    setConfirmNeedsReview(false);
    setToastTone(result.warning ? 'warning' : 'success');
    setToastMessage(result.warning ?? copy.home.savedToast);
    setUndoAction(
      result.reminderId
        ? {
            kind: 'remove_created',
            reminderId: result.reminderId,
          }
        : null
    );
  }

  async function handleUndoAction() {
    if (!undoAction) {
      return;
    }

    if (undoAction.kind === 'remove_created') {
      await removeReminder(undoAction.reminderId);
    } else {
      await restoreReminder(undoAction.reminder, 'home_undo');
    }

    setUndoAction(null);
    setToastMessage('');
  }

  async function handleNotificationAction() {
    if (notificationPermission === 'blocked') {
      await openNotificationSettings();
      return;
    }

    await requestNotificationAccess('home_banner');
  }

  async function handleUrgentDone() {
    if (!urgentReminder) {
      return;
    }

    await completeReminder(urgentReminder.id, 'home_due_card');
    setToastTone('success');
    setToastMessage(copy.home.urgentDoneToast);
    setUndoAction({
      kind: 'restore_snapshot',
      reminder: urgentReminder,
    });
  }

  async function handleUrgentSnooze() {
    if (!urgentReminder) {
      return;
    }

    await snoozeReminder(urgentReminder.id, 10, 'home_due_card');
    setToastTone('success');
    setToastMessage(copy.home.urgentSnoozeToast);
    setUndoAction({
      kind: 'restore_snapshot',
      reminder: urgentReminder,
    });
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
            <Text style={styles.voiceBrandTitle}>Fakarni</Text>
            <Text style={styles.voiceBrandSubtitle}>{copy.home.brandSubtitle}</Text>
          </View>
          <NavIconButton
            label={copy.common.reminders}
            onPress={() => navigation.navigate('ReminderList')}
            variant="reminders"
            showLabel={false}
          />
        </View>

        {permissionHealth ? (
          <GlassSurface
            style={styles.trustStrip}
            intensity={42}
            overlayColor="rgba(255,255,255,0.24)"
            borderColor="rgba(255,255,255,0.5)"
          >
            <View style={styles.trustStripCopy}>
              <Text style={styles.trustStripTitle}>{permissionHealth.title}</Text>
              <Text style={styles.trustStripBody}>{permissionHealth.body}</Text>
            </View>
            <Pressable
              onPress={() => void permissionHealth.onPress()}
              style={styles.trustStripAction}
            >
              <Text style={styles.trustStripActionText}>
                {permissionHealth.actionLabel}
              </Text>
            </Pressable>
          </GlassSurface>
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

          {showVoiceStatePill ? (
            <View style={[styles.voiceStatePill, busy && styles.voiceStatePillActive]}>
              <View style={styles.voiceStateDot} />
              <Text style={styles.voiceStateText}>{voiceStateLabel}</Text>
            </View>
          ) : null}

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
            {!isListening && !processing ? (
              <GlassSurface
                style={styles.examplePrompt}
                intensity={44}
                overlayColor="rgba(255,255,255,0.22)"
                borderColor="rgba(255,255,255,0.5)"
              >
                <Text style={styles.examplePromptLabel}>{copy.home.exampleLabel}</Text>
                <Text style={styles.examplePromptText}>{activeExample}</Text>
              </GlassSurface>
            ) : null}
            {isListening ? <Waveform pulse={pulse} /> : null}
            {processing ? (
              <ActivityIndicator color={colors.primaryDark} style={styles.processingSpinner} />
            ) : null}
          </View>

          {showTranscriptCard ? (
            <GlassSurface
              style={styles.voiceTranscriptCard}
              contentStyle={styles.voiceTranscriptCardContent}
              intensity={52}
              overlayColor="rgba(255,255,255,0.28)"
              borderColor="rgba(255,255,255,0.5)"
            >
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
            </GlassSurface>
          ) : null}

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

        {urgentReminder && urgentReminderSnapshot ? (
          <GlassSurface
            style={styles.urgentCard}
            contentStyle={styles.urgentCardContent}
            intensity={50}
            overlayColor="rgba(255,255,255,0.26)"
            borderColor="rgba(255,255,255,0.56)"
          >
            <View style={styles.urgentCardHeader}>
              <View
                style={[
                  styles.urgentStatusPill,
                  urgentReminderSnapshot.isOverdue && styles.urgentStatusPillOverdue,
                ]}
              >
                <Text
                  style={[
                    styles.urgentStatusPillText,
                    urgentReminderSnapshot.isOverdue &&
                      styles.urgentStatusPillTextOverdue,
                  ]}
                >
                  {urgentReminderSnapshot.isOverdue
                    ? copy.home.urgentStatusOverdue
                    : copy.home.urgentStatusNow}
                </Text>
              </View>
              <Text style={styles.urgentCardEyebrow}>{copy.home.urgentCardTitle}</Text>
            </View>
            <Text numberOfLines={2} style={styles.urgentCardTitle}>
              {urgentReminder.title}
            </Text>
            <View style={styles.urgentMetaRow}>
              <View style={styles.urgentMetaPill}>
                <Text style={styles.urgentMetaPillLabel}>{copy.home.nearestNow}</Text>
                <Text numberOfLines={1} style={styles.urgentMetaPillValue}>
                  {toArabicDateTimeLabel(
                    urgentReminderSnapshot.activeReminderAt,
                    settings.uiLanguage
                  )}
                </Text>
              </View>
              <View style={[styles.categoryPill, styles.urgentCategoryPill]}>
                <Text style={styles.categoryPillText}>
                  {getReminderCategoryLabel(urgentReminder.category, settings.uiLanguage)}
                </Text>
              </View>
            </View>
            <View style={styles.urgentActions}>
              <Pressable onPress={() => void handleUrgentSnooze()} style={styles.urgentAction}>
                <Text style={styles.urgentActionSecondaryText}>
                  {copy.home.urgentSnoozeAction}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleUrgentDone()}
                style={[styles.urgentAction, styles.urgentActionPrimary]}
              >
                <Text style={styles.urgentActionPrimaryText}>{copy.common.done}</Text>
              </Pressable>
            </View>
          </GlassSurface>
        ) : null}

        {showNextReminderCard ? (
          <Pressable
            onPress={() => navigation.navigate('ReminderList')}
            style={styles.latestReminderPressable}
          >
            <GlassSurface
              style={styles.latestReminderCard}
              contentStyle={styles.latestReminderCardContent}
              intensity={46}
              overlayColor="rgba(255,255,255,0.24)"
              borderColor="rgba(255,255,255,0.48)"
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
              ) : null}
            </GlassSurface>
          </Pressable>
        ) : null}

        {pendingParse ? (
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={pauseAutoConfirm} />
            <Animated.View
              style={[
                styles.confirmCardFrame,
                {
                  opacity: confirmOpacity,
                  transform: [{ scale: confirmScale }],
                },
              ]}
            >
              <GlassSurface
                style={styles.confirmCard}
                intensity={72}
                overlayColor={
                  isHighConfidenceCard
                    ? 'rgba(255,255,255,0.26)'
                    : 'rgba(255,248,228,0.38)'
                }
                borderColor={
                  isHighConfidenceCard
                    ? 'rgba(255,255,255,0.56)'
                    : 'rgba(241,228,188,0.9)'
                }
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

                  <Text
                    style={[
                      styles.confirmWarningText,
                      isHighConfidenceCard && styles.confirmWarningTextMuted,
                    ]}
                  >
                    {isHighConfidenceCard
                      ? settings.uiLanguage === 'en'
                        ? 'Quick review, then save or let it finish.'
                        : 'راجعها بسرعة أو سيبها تكمل.'
                      : copy.home.confirmWarning}
                  </Text>

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

                  <View style={styles.confirmMetaCard}>
                    <Text style={styles.confirmMetaLabel}>{reminderTimingLabel}</Text>
                    <Text style={styles.confirmMeta}>
                      {relativeReminderLabel(pendingParse.draft.offsetMinutes, settings.uiLanguage)}
                    </Text>
                  </View>

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
              </GlassSurface>
            </Animated.View>
          </View>
        ) : null}

        {toastMessage ? (
          <View
            style={[
              styles.toast,
              toastTone === 'warning' ? styles.toastWarning : styles.toastSuccess,
            ]}
          >
            <Text style={styles.toastText}>{toastMessage}</Text>
            {undoAction ? (
              <Pressable
                onPress={() => {
                  void handleUndoAction();
                }}
                style={styles.toastShare}
              >
                <Text style={styles.toastShareText}>{copy.home.undo}</Text>
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
    gap: 10,
  },
  voiceTopBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  voiceBrand: {
    alignItems: 'center',
    gap: 1,
  },
  voiceBrandTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  voiceBrandSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  trustStrip: {
    borderRadius: radii.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  trustStripCopy: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  trustStripTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  trustStripBody: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  trustStripAction: {
    alignSelf: 'flex-end',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(108,92,231,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  trustStripActionText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  voiceCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  voiceTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  voiceSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    writingDirection: 'rtl',
    maxWidth: 248,
  },
  voiceStatePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
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
    maxWidth: 320,
    minHeight: 66,
    borderRadius: radii.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  voiceTranscriptCardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 4,
  },
  voiceTranscriptText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
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
  urgentCard: {
    borderRadius: radii.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  urgentCardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  urgentCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  urgentCardEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  urgentStatusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(108,92,231,0.12)',
  },
  urgentStatusPillOverdue: {
    backgroundColor: 'rgba(199,75,67,0.12)',
  },
  urgentStatusPillText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  urgentStatusPillTextOverdue: {
    color: colors.danger,
  },
  urgentCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 28,
    writingDirection: 'rtl',
  },
  urgentMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  urgentMetaPill: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  urgentMetaPillLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  urgentMetaPillValue: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  urgentCategoryPill: {
    alignSelf: 'center',
    minHeight: 42,
    justifyContent: 'center',
    backgroundColor: 'rgba(108,92,231,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  urgentActions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: 2,
  },
  urgentAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(108,92,231,0.2)',
  },
  urgentActionSecondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  urgentActionPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
    writingDirection: 'rtl',
  },
  latestReminderPressable: {
    alignSelf: 'stretch',
  },
  latestReminderCard: {
    borderRadius: radii.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  latestReminderCardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.xs,
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
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  latestReminderMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
    marginTop: -26,
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  },
  micStageCompact: {
    marginTop: -20,
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
  examplePrompt: {
    marginTop: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 2,
  },
  examplePromptLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    writingDirection: 'rtl',
  },
  examplePromptText: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
    writingDirection: 'rtl',
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
    backgroundColor: 'rgba(23,19,41,0.4)',
    padding: spacing.lg,
    zIndex: 40,
    elevation: 20,
  },
  confirmCardFrame: {
    width: '88%',
    maxWidth: 356,
  },
  confirmCard: {
    borderRadius: 26,
    shadowColor: colors.shadow,
    shadowOpacity: 0.36,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    overflow: 'hidden',
    zIndex: 41,
  },
  confirmCardInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 18,
    gap: 10,
  },
  confirmStateBadge: {
    alignSelf: 'flex-end',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(108,92,231,0.07)',
  },
  confirmStateBadgeWarning: {
    backgroundColor: '#FFF7DD',
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
    fontSize: 18,
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
  confirmWarningText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  confirmWarningTextMuted: {
    color: colors.textMuted,
  },
  confirmDetailGrid: {
    gap: spacing.xs,
  },
  confirmDetailCard: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: '#F7F7FC',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.07)',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmDetailCardActive: {
    borderColor: 'rgba(108,92,231,0.22)',
    backgroundColor: '#F2F0FF',
  },
  confirmDetailCardWarning: {
    backgroundColor: '#FFF9EA',
    borderColor: '#F0E0AE',
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
    color: colors.text,
  },
  confirmDetailAction: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  confirmMetaCard: {
    borderRadius: radii.md,
    backgroundColor: '#F8F8FB',
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
    alignItems: 'flex-end',
  },
  confirmMetaLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmMeta: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
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
  confirmActions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: 2,
  },
  confirmAction: {
    flex: 1,
    minHeight: 46,
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
    marginTop: 2,
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
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '88%',
    borderWidth: 1,
  },
  toastSuccess: {
    backgroundColor: colors.white,
    borderColor: colors.line,
  },
  toastWarning: {
    backgroundColor: '#FFF8E8',
    borderColor: '#F3D48E',
  },
  toastText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  toastShare: {
    backgroundColor: 'rgba(108,92,231,0.08)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  toastShareText: {
    color: colors.primary,
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
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.primaryDark,
    backgroundColor: 'transparent',
  },
  gearCenter: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryDark,
  },
  gearTooth: {
    position: 'absolute',
    width: 3,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: colors.primaryDark,
  },
  toothTop: {
    top: 0.5,
  },
  toothBottom: {
    bottom: 0.5,
  },
  toothLeft: {
    left: 0.5,
    transform: [{ rotate: '90deg' }],
  },
  toothRight: {
    right: 0.5,
    transform: [{ rotate: '90deg' }],
  },
  toothTopLeft: {
    top: 1.7,
    left: 1.7,
    transform: [{ rotate: '45deg' }],
  },
  toothTopRight: {
    top: 1.7,
    right: 1.7,
    transform: [{ rotate: '-45deg' }],
  },
  toothBottomLeft: {
    bottom: 1.7,
    left: 1.7,
    transform: [{ rotate: '-45deg' }],
  },
  toothBottomRight: {
    bottom: 1.7,
    right: 1.7,
    transform: [{ rotate: '45deg' }],
  },
});
