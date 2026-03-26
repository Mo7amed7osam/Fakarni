import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { GlassSurface } from '../components/GlassSurface';
import { GhostButton } from '../components/GhostButton';
import { getAppCopy } from '../content/appCopy';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import {
  buildReminderAnalyticsProperties,
  getCalendarMode,
  track,
} from '../services/analytics';
import { colors, fonts, radii, spacing } from '../theme';
import { Recurrence, ReminderCategory, RootStackParamList } from '../types';
import {
  relativeReminderLabel,
  toArabicDateLabel,
  toArabicTimeLabel,
} from '../utils/arabic';
import { getReminderCategoryLabel } from '../utils/categorization';
import { getRecurrenceLabel } from '../utils/reminders';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirmation'>;

const offsetOptions = [0, 30, 60, 120];
const recurrenceOptions: Recurrence[] = ['none', 'daily', 'weekly', 'weekdays'];
const categoryOptions: ReminderCategory[] = [
  'study',
  'work',
  'meeting',
  'health',
  'shopping',
  'finance',
  'personal',
  'other',
];

export function ConfirmationScreen({ navigation, route }: Props) {
  const { createReminder, updateReminder, settings, notificationPermission } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const { draft, transcript, confidence, missingFields, mode, reminderId } = route.params;
  const isEdit = mode === 'edit';
  const isManualCreate = !isEdit && !transcript.trim();
  const entryPoint = isEdit
    ? 'edit'
    : isManualCreate
      ? 'manual_confirmation'
      : 'voice_home';
  const isVoiceFlow = !isEdit && Boolean(transcript.trim());
  const [title, setTitle] = useState(draft.title);
  const [category, setCategory] = useState<ReminderCategory>(draft.category);
  const [eventDate, setEventDate] = useState(new Date(draft.eventAt));
  const [offsetMinutes, setOffsetMinutes] = useState(draft.offsetMinutes);
  const [recurrence, setRecurrence] = useState<Recurrence>(draft.recurrence);
  const [addToCalendar, setAddToCalendar] = useState(Boolean(draft.addToCalendar));
  const [showMode, setShowMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const showAndroidCalendarToggle = !isEdit && Platform.OS === 'android';
  const showAppleCalendarSyncHint =
    !isEdit && Platform.OS === 'ios' && settings.appleCalendar.autoSyncEnabled;
  const calendarSubtitle = settings.googleCalendar.connected
    ? settings.uiLanguage === 'en'
      ? 'It will be added to Google Calendar in the background.'
      : 'هيتضاف لـ Google Calendar في الخلفية.'
    : settings.uiLanguage === 'en'
      ? 'It will be added to the device calendar if permission is available.'
      : 'هيتضاف لتقويم الجهاز لو الصلاحية متاحة.';
  const calendarMode = getCalendarMode({
    settings,
    addToCalendar,
  });

  const reminderAt = useMemo(
    () => dayjs(eventDate).subtract(offsetMinutes, 'minute').toDate(),
    [eventDate, offsetMinutes]
  );

  const confidenceLabel =
    confidence >= 0.8
      ? copy.confirmation.confidenceHigh
      : confidence >= 0.6
        ? copy.confirmation.confidenceMedium
        : copy.confirmation.confidenceLow;

  useEffect(() => {
    track('reminder confirmation shown', {
      entry_point: entryPoint,
      manual_edit_after_parse: entryPoint === 'voice_home',
      ...buildReminderAnalyticsProperties({
        draft: {
          category,
          eventAt: eventDate.toISOString(),
          offsetMinutes,
          recurrence,
        },
        entryPoint: entryPoint,
        isVoiceFlow,
        notificationPermissionState: notificationPermission,
        calendarMode,
        parseConfidence: confidence,
        missingFields,
        confirmationMode: 'full',
      }),
    });
    // Track once when the screen is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getEditedFieldsCount(nextDraft: typeof draft) {
    let count = 0;
    const normalizedOriginalEventAt = dayjs(draft.eventAt)
      .second(0)
      .millisecond(0)
      .toISOString();
    const normalizedNextEventAt = dayjs(nextDraft.eventAt)
      .second(0)
      .millisecond(0)
      .toISOString();

    if (draft.title.trim() !== nextDraft.title.trim()) {
      count += 1;
    }
    if (draft.category !== nextDraft.category) {
      count += 1;
    }
    if (normalizedOriginalEventAt !== normalizedNextEventAt) {
      count += 1;
    }
    if (draft.offsetMinutes !== nextDraft.offsetMinutes) {
      count += 1;
    }
    if (draft.recurrence !== nextDraft.recurrence) {
      count += 1;
    }
    if (showAndroidCalendarToggle && Boolean(draft.addToCalendar) !== Boolean(nextDraft.addToCalendar)) {
      count += 1;
    }

    return count;
  }

  function handleDateTimeChange(
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) {
    if (selectedDate) {
      setEventDate(selectedDate);
    }

    if (Platform.OS !== 'ios') {
      setShowMode(null);
    }
  }

  async function handleSave() {
    setValidationError('');
    const nextDraft = {
      title,
      category,
      eventAt: eventDate.toISOString(),
      offsetMinutes,
      recurrence,
      addToCalendar: showAndroidCalendarToggle ? addToCalendar : undefined,
    };
    const editedFieldsCount = getEditedFieldsCount(nextDraft);
    if (!title.trim()) {
      if (!isEdit) {
        track('reminder create failed', {
          entry_point: entryPoint,
          manual_edit_after_parse: entryPoint === 'voice_home',
          ...buildReminderAnalyticsProperties({
            draft: nextDraft,
            entryPoint,
            isVoiceFlow,
            notificationPermissionState: notificationPermission,
            calendarMode,
            parseConfidence: confidence,
            missingFields,
            confirmationMode: 'full',
            editedFieldsCount,
            resultReason: 'missing_title',
          }),
        });
      }
      setValidationError(copy.confirmation.clearName);
      return;
    }

    if (dayjs(reminderAt).isBefore(dayjs())) {
      if (!isEdit) {
        track('reminder create failed', {
          entry_point: entryPoint,
          manual_edit_after_parse: entryPoint === 'voice_home',
          ...buildReminderAnalyticsProperties({
            draft: nextDraft,
            entryPoint,
            isVoiceFlow,
            notificationPermissionState: notificationPermission,
            calendarMode,
            parseConfidence: confidence,
            missingFields,
            confirmationMode: 'full',
            editedFieldsCount,
            resultReason: 'past_reminder_time',
          }),
        });
      }
      setValidationError(copy.confirmation.futureTime);
      return;
    }

    setSaving(true);
    const result =
      isEdit && reminderId
        ? await updateReminder(reminderId, nextDraft, transcript)
        : await createReminder(nextDraft, transcript);
    setSaving(false);

    if (!result.ok) {
      if (!isEdit) {
        track('reminder create failed', {
          entry_point: entryPoint,
          manual_edit_after_parse: entryPoint === 'voice_home',
          ...buildReminderAnalyticsProperties({
            draft: nextDraft,
            entryPoint,
            isVoiceFlow,
            notificationPermissionState: notificationPermission,
            calendarMode,
            parseConfidence: confidence,
            missingFields,
            confirmationMode: 'full',
            editedFieldsCount,
            resultReason: result.reason,
          }),
        });
      }
      setValidationError(result.reason ?? copy.confirmation.needsReview);
      return;
    }

    if (isEdit) {
      track('reminder updated', {
        entry_point: entryPoint,
        notification_status: result.warning ? 'warning' : 'ok',
        manual_edit_after_parse: entryPoint === 'voice_home',
        save_without_edit: entryPoint === 'voice_home' ? editedFieldsCount === 0 : undefined,
        ...buildReminderAnalyticsProperties({
          draft: nextDraft,
          entryPoint,
          isVoiceFlow,
          notificationPermissionState: notificationPermission,
          calendarMode,
          parseConfidence: confidence,
          missingFields,
          confirmationMode: 'full',
          editedFieldsCount,
        }),
      });
    } else {
      track('reminder create succeeded', {
        entry_point: entryPoint,
        notification_status: result.warning ? 'warning' : 'ok',
        manual_edit_after_parse: entryPoint === 'voice_home',
        save_without_edit: entryPoint === 'voice_home' ? editedFieldsCount === 0 : undefined,
        ...buildReminderAnalyticsProperties({
          draft: nextDraft,
          entryPoint,
          isVoiceFlow,
          notificationPermissionState: notificationPermission,
          calendarMode,
          parseConfidence: confidence,
          missingFields,
          confirmationMode: 'full',
          editedFieldsCount,
        }),
      });
    }

    if (result.warning) {
      Alert.alert(copy.confirmation.savedTitle, result.warning, [
        {
          text: copy.common.save,
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]);
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {isEdit
          ? copy.confirmation.titleEdit
          : isManualCreate
            ? copy.confirmation.titleManual
            : copy.confirmation.titleVoice}
      </Text>
      <Text style={styles.subtitle}>
        {isEdit
          ? copy.confirmation.subtitleEdit
          : isManualCreate
            ? copy.confirmation.subtitleManual
            : copy.confirmation.subtitleVoice}
      </Text>

      <GlassSurface
        style={styles.heroCard}
        contentStyle={styles.heroCardContent}
        intensity={52}
        overlayColor="rgba(255,255,255,0.24)"
        borderColor="rgba(255,255,255,0.5)"
      >
        <Text style={styles.heroLabel}>
          {isEdit
            ? copy.confirmation.heroEdit
            : isManualCreate
              ? copy.confirmation.heroManual
              : copy.confirmation.heroVoice}
        </Text>
        <Text style={styles.heroValue}>{confidenceLabel}</Text>
        <Text style={styles.heroCaption}>
          {isEdit
            ? copy.confirmation.heroEditCaption
            : isManualCreate
              ? copy.confirmation.heroManualCaption
            : missingFields.length
              ? settings.uiLanguage === 'en'
                ? `Review: ${missingFields.join(' / ')}`
                : `راجع: ${missingFields.join(' / ')}`
              : copy.confirmation.heroVoiceCaptionNoMissing}
        </Text>
      </GlassSurface>

      {transcript.trim() ? (
        <SectionCard title={isEdit ? copy.confirmation.originalText : copy.confirmation.heardText}>
          <Text style={styles.bodyText}>{transcript}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={copy.confirmation.taskName}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={
            settings.uiLanguage === 'en' ? 'Example: Doctor appointment' : 'مثال: ميعاد الدكتور'
          }
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
        />
      </SectionCard>

      <SectionCard title={copy.confirmation.schedule}>
        <View style={styles.row}>
          <Pressable onPress={() => setShowMode('time')} style={styles.fieldChip}>
            <Text style={styles.fieldChipLabel}>{copy.confirmation.time}</Text>
            <Text style={styles.fieldChipValue}>
              {toArabicTimeLabel(eventDate, settings.uiLanguage)}
            </Text>
          </Pressable>
          <Pressable onPress={() => setShowMode('date')} style={styles.fieldChip}>
            <Text style={styles.fieldChipLabel}>{copy.confirmation.day}</Text>
            <Text style={styles.fieldChipValue}>
              {toArabicDateLabel(eventDate, settings.uiLanguage)}
            </Text>
          </Pressable>
        </View>

        {showMode ? (
          <DateTimePicker
            mode={showMode}
            value={eventDate}
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateTimeChange}
          />
        ) : null}
      </SectionCard>

      <SectionCard title={copy.confirmation.reminderTime}>
        <View style={styles.choiceRow}>
          {offsetOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => setOffsetMinutes(value)}
              style={[
                styles.choiceChip,
                value === offsetMinutes && styles.choiceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  value === offsetMinutes && styles.choiceTextActive,
                ]}
              >
                {relativeReminderLabel(value, settings.uiLanguage)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.bodyText}>
          {copy.confirmation.reminderWillArriveAt(
            toArabicDateLabel(reminderAt, settings.uiLanguage),
            toArabicTimeLabel(reminderAt, settings.uiLanguage)
          )}
        </Text>
      </SectionCard>

      <SectionCard title={copy.confirmation.recurrence}>
        <View style={styles.choiceRow}>
          {recurrenceOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => setRecurrence(value)}
              style={[
                styles.choiceChip,
                value === recurrence && styles.choiceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  value === recurrence && styles.choiceTextActive,
                ]}
              >
                {getRecurrenceLabel(value, settings.uiLanguage)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title={copy.confirmation.taskCategory}
        subtitle={copy.confirmation.taskCategorySubtitle}
      >
        <View style={styles.choiceRow}>
          {categoryOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => setCategory(value)}
              style={[
                styles.choiceChip,
                value === category && styles.choiceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  value === category && styles.choiceTextActive,
                ]}
              >
                {getReminderCategoryLabel(value, settings.uiLanguage)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {showAppleCalendarSyncHint ? (
        <View style={styles.inlineCalendarHint}>
          <Text style={styles.inlineCalendarHintText}>
            {copy.confirmation.iosCalendarHint}
          </Text>
        </View>
      ) : null}

      {showAndroidCalendarToggle ? (
        <SectionCard title={copy.confirmation.calendar} subtitle={calendarSubtitle}>
          <View style={styles.calendarRow}>
            <Pressable
              onPress={() => setAddToCalendar((current) => !current)}
              style={[styles.calendarToggle, addToCalendar && styles.calendarToggleActive]}
            >
              <View
                style={[
                  styles.calendarToggleKnob,
                  addToCalendar && styles.calendarToggleKnobActive,
                ]}
              />
            </Pressable>
            <View style={styles.calendarText}>
              <Text style={styles.calendarTitle}>{copy.confirmation.addToCalendar}</Text>
              <Text style={styles.calendarHint}>{copy.confirmation.calendarHint}</Text>
            </View>
          </View>
        </SectionCard>
      ) : null}

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}

      <View style={styles.footer}>
        <GhostButton
          label={
            saving
              ? copy.confirmation.saving
              : isEdit
                ? copy.confirmation.saveEdit
                : copy.confirmation.saveReminder
          }
          onPress={handleSave}
          disabled={saving}
        />
        <GhostButton
          label={copy.common.back}
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
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
    fontSize: 20,
    color: colors.text,
    maxWidth: 260,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  heroCard: {
    borderRadius: radii.lg,
  },
  heroCardContent: {
    padding: 18,
    gap: spacing.xs,
  },
  heroLabel: {
    alignSelf: 'flex-end',
    color: colors.primary,
    backgroundColor: 'rgba(108,92,231,0.08)',
    fontFamily: fonts.semibold,
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroCaption: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  bodyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
    writingDirection: 'rtl',
  },
  row: {
    gap: spacing.sm,
  },
  fieldChip: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  fieldChipLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldChipValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  choiceRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  choiceChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceText: {
    fontFamily: fonts.semibold,
    color: colors.text,
    writingDirection: 'rtl',
  },
  choiceTextActive: {
    color: colors.white,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  calendarRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  calendarToggle: {
    width: 54,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: '#D9D2C5',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  calendarToggleActive: {
    backgroundColor: colors.primary,
  },
  calendarToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  calendarToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  calendarText: {
    flex: 1,
    gap: spacing.xs,
  },
  calendarTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  calendarHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  inlineCalendarHint: {
    backgroundColor: '#F2F7F6',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#D5E7E0',
  },
  inlineCalendarHintText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  footer: {
    gap: spacing.md,
  },
});
