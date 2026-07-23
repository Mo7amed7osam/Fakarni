import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { getResponsiveContentWidth, isTabletWidth } from '../utils/layout';
import {
  relativeReminderLabel,
  toArabicDateLabel,
  toArabicTimeLabel,
  toCompactDateLabel,
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
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
  const contentMaxWidth = getResponsiveContentWidth(width, 980);
  const copy = getAppCopy(settings.uiLanguage);
  const { draft, transcript, confidence, missingFields, mode, reminderId } = route.params;
  const isEdit = mode === 'edit';
  const isManualCreate = !isEdit && !transcript.trim();
  const useCompactLayout =
    isEdit ||
    isManualCreate ||
    (Boolean(transcript.trim()) && (confidence < 0.9 || missingFields.length > 0));
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
  const [isAlarm, setIsAlarm] = useState(Boolean(draft.isAlarm ?? true));
  const [showMode, setShowMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showMoreOptions, setShowMoreOptions] = useState(
    isEdit &&
      (draft.category !== 'personal' ||
        draft.recurrence !== 'none' ||
        Boolean(draft.addToCalendar))
  );
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

  function dismissPicker() {
    setShowMode(null);
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
      isAlarm,
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.contentInner, { maxWidth: contentMaxWidth }]}>
      <Text style={[styles.title, tabletLayout && styles.titleTablet]}>
        {isEdit
          ? copy.confirmation.titleEdit
          : isManualCreate
            ? copy.confirmation.titleManual
            : copy.confirmation.titleVoice}
      </Text>
      <Text style={[styles.subtitle, tabletLayout && styles.subtitleTablet]}>
        {isEdit
          ? copy.confirmation.subtitleEdit
          : isManualCreate
            ? copy.confirmation.subtitleManual
            : copy.confirmation.subtitleVoice}
      </Text>

      {!isManualCreate ? (
        <GlassSurface
          style={styles.heroCard}
          contentStyle={[styles.heroCardContent, tabletLayout && styles.heroCardContentTablet]}
          intensity={52}
          overlayColor="rgba(255,255,255,0.24)"
          borderColor="rgba(255,255,255,0.5)"
        >
          <Text style={[styles.heroLabel, tabletLayout && styles.heroLabelTablet]}>
            {isEdit ? copy.confirmation.heroEdit : copy.confirmation.heroVoice}
          </Text>
          <Text style={[styles.heroValue, tabletLayout && styles.heroValueTablet]}>{confidenceLabel}</Text>
          <Text style={[styles.heroCaption, tabletLayout && styles.heroCaptionTablet]}>
            {isEdit
              ? copy.confirmation.heroEditCaption
              : missingFields.length
                ? settings.uiLanguage === 'en'
                  ? `Review: ${missingFields.join(' / ')}`
                  : `راجع: ${missingFields.join(' / ')}`
                : copy.confirmation.heroVoiceCaptionNoMissing}
          </Text>
        </GlassSurface>
      ) : null}

      {transcript.trim() ? (
        <SectionCard title={isEdit ? copy.confirmation.originalText : copy.confirmation.heardText}>
          <Text style={[styles.bodyText, tabletLayout && styles.bodyTextTablet]}>{transcript}</Text>
        </SectionCard>
      ) : null}

      {useCompactLayout ? (
        <>
          <GlassSurface
            style={styles.compactCard}
            contentStyle={[
              styles.compactCardContent,
              tabletLayout && styles.compactCardContentTablet,
            ]}
            intensity={48}
            overlayColor="rgba(255,255,255,0.24)"
            borderColor="rgba(255,255,255,0.5)"
          >
            <View style={styles.compactBlock}>
              <Text style={[styles.compactLabel, tabletLayout && styles.compactLabelTablet]}>
                {copy.confirmation.taskName}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  settings.uiLanguage === 'en'
                    ? 'Example: Doctor appointment'
                    : 'مثال: ميعاد الدكتور'
                }
                placeholderTextColor={colors.textMuted}
                style={[styles.input, tabletLayout && styles.inputTablet]}
                textAlign="right"
              />
            </View>

            <View style={styles.compactBlock}>
              <Text style={[styles.compactLabel, tabletLayout && styles.compactLabelTablet]}>
                {copy.confirmation.schedule}
              </Text>
              <View style={[styles.row, tabletLayout && styles.rowTablet]}>
                <Pressable
                  onPress={() => setShowMode('time')}
                  style={[styles.fieldChip, tabletLayout && styles.fieldChipTablet]}
                >
                  <Text style={[styles.fieldChipLabel, tabletLayout && styles.fieldChipLabelTablet]}>
                    {copy.confirmation.time}
                  </Text>
                  <Text style={[styles.fieldChipValue, tabletLayout && styles.fieldChipValueTablet]}>
                    {toArabicTimeLabel(eventDate, settings.uiLanguage)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowMode('date')}
                  style={[styles.fieldChip, tabletLayout && styles.fieldChipTablet]}
                >
                  <Text style={[styles.fieldChipLabel, tabletLayout && styles.fieldChipLabelTablet]}>
                    {copy.confirmation.day}
                  </Text>
                  <Text style={[styles.fieldChipValue, tabletLayout && styles.fieldChipValueTablet]}>
                    {toCompactDateLabel(eventDate, settings.uiLanguage)}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.compactBlock}>
              <Text style={[styles.compactLabel, tabletLayout && styles.compactLabelTablet]}>
                {copy.confirmation.reminderTime}
              </Text>
              <View style={[styles.choiceRow, tabletLayout && styles.choiceRowTablet]}>
                {offsetOptions.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setOffsetMinutes(value)}
                    style={[
                      styles.choiceChip,
                      tabletLayout && styles.choiceChipTablet,
                      styles.choiceChipCompact,
                      value === offsetMinutes && styles.choiceChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        tabletLayout && styles.choiceTextTablet,
                        value === offsetMinutes && styles.choiceTextActive,
                      ]}
                    >
                      {relativeReminderLabel(value, settings.uiLanguage)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.compactSummary, tabletLayout && styles.compactSummaryTablet]}>
              <Text
                style={[styles.compactSummaryLabel, tabletLayout && styles.compactSummaryLabelTablet]}
              >
                {copy.confirmation.quickSummary}
              </Text>
              <Text style={[styles.compactSummaryText, tabletLayout && styles.compactSummaryTextTablet]}>
                {copy.confirmation.reminderWillArriveAt(
                  toCompactDateLabel(reminderAt, settings.uiLanguage),
                  toArabicTimeLabel(reminderAt, settings.uiLanguage)
                )}
              </Text>
            </View>

            {showMode ? (
              <View style={styles.pickerWrap}>
                {Platform.OS === 'ios' ? (
                  <View style={styles.pickerHeader}>
                    <Text style={[styles.pickerHeaderTitle, tabletLayout && styles.pickerHeaderTitleTablet]}>
                      {showMode === 'date' ? copy.common.chooseDate : copy.common.chooseTime}
                    </Text>
                    <Pressable onPress={dismissPicker} style={styles.pickerDoneChip}>
                      <Text style={[styles.pickerDoneText, tabletLayout && styles.pickerDoneTextTablet]}>
                        {copy.common.save}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <DateTimePicker
                  mode={showMode}
                  value={eventDate}
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateTimeChange}
                />
              </View>
            ) : null}
          </GlassSurface>

          <Pressable
            onPress={() => setShowMoreOptions((current) => !current)}
            style={[styles.moreOptionsToggle, tabletLayout && styles.moreOptionsToggleTablet]}
          >
            <Text style={[styles.moreOptionsToggleText, tabletLayout && styles.moreOptionsToggleTextTablet]}>
              {showMoreOptions
                ? copy.confirmation.hideMoreOptions
                : copy.confirmation.showMoreOptions}
            </Text>
          </Pressable>

          {showMoreOptions ? (
            <SectionCard title={copy.confirmation.moreOptions}>
              <View style={styles.optionGroup}>
                <Text style={[styles.optionLabel, tabletLayout && styles.optionLabelTablet]}>
                  {copy.confirmation.recurrence}
                </Text>
                <View style={[styles.choiceRow, tabletLayout && styles.choiceRowTablet]}>
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
                        tabletLayout && styles.choiceTextTablet,
                        value === recurrence && styles.choiceTextActive,
                        ]}
                      >
                        {getRecurrenceLabel(value, settings.uiLanguage)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.optionGroup}>
                <Text style={[styles.optionLabel, tabletLayout && styles.optionLabelTablet]}>
                  {copy.confirmation.taskCategory}
                </Text>
                <View style={[styles.choiceRow, tabletLayout && styles.choiceRowTablet]}>
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
                        tabletLayout && styles.choiceTextTablet,
                        value === category && styles.choiceTextActive,
                        ]}
                      >
                        {getReminderCategoryLabel(value, settings.uiLanguage)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {showAppleCalendarSyncHint ? (
                <View style={[styles.inlineCalendarHint, tabletLayout && styles.inlineCalendarHintTablet]}>
                  <Text
                    style={[
                      styles.inlineCalendarHintText,
                      tabletLayout && styles.inlineCalendarHintTextTablet,
                    ]}
                  >
                    {copy.confirmation.iosCalendarHint}
                  </Text>
                </View>
              ) : null}

              {showAndroidCalendarToggle ? (
                <View style={styles.optionGroup}>
                  <Text style={[styles.optionLabel, tabletLayout && styles.optionLabelTablet]}>
                    {copy.confirmation.calendar}
                  </Text>
                  <View style={[styles.calendarRow, tabletLayout && styles.calendarRowTablet]}>
                    <Pressable
                      onPress={() => setAddToCalendar((current) => !current)}
                      style={[
                        styles.calendarToggle,
                        addToCalendar && styles.calendarToggleActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.calendarToggleKnob,
                          addToCalendar && styles.calendarToggleKnobActive,
                        ]}
                      />
                    </Pressable>
                    <View style={styles.calendarText}>
                      <Text style={[styles.calendarTitle, tabletLayout && styles.calendarTitleTablet]}>
                        {copy.confirmation.addToCalendar}
                      </Text>
                      <Text style={[styles.calendarHint, tabletLayout && styles.calendarHintTablet]}>
                        {copy.confirmation.calendarHint}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.optionGroup}>
                <Text style={[styles.optionLabel, tabletLayout && styles.optionLabelTablet]}>
                  منبه قوي (AlarmKit)
                </Text>
                <View style={[styles.calendarRow, tabletLayout && styles.calendarRowTablet]}>
                  <Pressable
                    onPress={() => setIsAlarm((current) => !current)}
                    style={[
                      styles.calendarToggle,
                      isAlarm && styles.calendarToggleActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.calendarToggleKnob,
                        isAlarm && styles.calendarToggleKnobActive,
                      ]}
                    />
                  </Pressable>
                  <View style={styles.calendarText}>
                    <Text style={[styles.calendarTitle, tabletLayout && styles.calendarTitleTablet]}>
                      تفعيل رنين المنبه
                    </Text>
                    <Text style={[styles.calendarHint, tabletLayout && styles.calendarHintTablet]}>
                      سيقوم الهاتف بالرنين بصوت عالٍ حتى لو كان صامتاً.
                    </Text>
                  </View>
                </View>
              </View>
            </SectionCard>
          ) : null}
        </>
      ) : (
        <>
          <SectionCard title={copy.confirmation.taskName}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={
                settings.uiLanguage === 'en'
                  ? 'Example: Doctor appointment'
                  : 'مثال: ميعاد الدكتور'
              }
              placeholderTextColor={colors.textMuted}
              style={[styles.input, tabletLayout && styles.inputTablet]}
              textAlign="right"
            />
          </SectionCard>

          <SectionCard title={copy.confirmation.schedule}>
            <View style={[styles.row, tabletLayout && styles.rowTablet]}>
              <Pressable
                onPress={() => setShowMode('time')}
                style={[styles.fieldChip, tabletLayout && styles.fieldChipTablet]}
              >
                <Text style={[styles.fieldChipLabel, tabletLayout && styles.fieldChipLabelTablet]}>
                  {copy.confirmation.time}
                </Text>
                <Text style={[styles.fieldChipValue, tabletLayout && styles.fieldChipValueTablet]}>
                  {toArabicTimeLabel(eventDate, settings.uiLanguage)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowMode('date')}
                style={[styles.fieldChip, tabletLayout && styles.fieldChipTablet]}
              >
                <Text style={[styles.fieldChipLabel, tabletLayout && styles.fieldChipLabelTablet]}>
                  {copy.confirmation.day}
                </Text>
                <Text style={[styles.fieldChipValue, tabletLayout && styles.fieldChipValueTablet]}>
                  {toCompactDateLabel(eventDate, settings.uiLanguage)}
                </Text>
              </Pressable>
            </View>

            {showMode ? (
              <View style={styles.pickerWrap}>
                {Platform.OS === 'ios' ? (
                  <View style={styles.pickerHeader}>
                    <Text style={[styles.pickerHeaderTitle, tabletLayout && styles.pickerHeaderTitleTablet]}>
                      {showMode === 'date' ? copy.common.chooseDate : copy.common.chooseTime}
                    </Text>
                    <Pressable onPress={dismissPicker} style={styles.pickerDoneChip}>
                      <Text style={[styles.pickerDoneText, tabletLayout && styles.pickerDoneTextTablet]}>
                        {copy.common.save}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <DateTimePicker
                  mode={showMode}
                  value={eventDate}
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateTimeChange}
                />
              </View>
            ) : null}
          </SectionCard>

          <SectionCard title={copy.confirmation.reminderTime}>
            <View style={[styles.choiceRow, tabletLayout && styles.choiceRowTablet]}>
              {offsetOptions.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setOffsetMinutes(value)}
                  style={[
                    styles.choiceChip,
                    tabletLayout && styles.choiceChipTablet,
                    value === offsetMinutes && styles.choiceChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      tabletLayout && styles.choiceTextTablet,
                      value === offsetMinutes && styles.choiceTextActive,
                    ]}
                  >
                    {relativeReminderLabel(value, settings.uiLanguage)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.bodyText, tabletLayout && styles.bodyTextTablet]}>
              {copy.confirmation.reminderWillArriveAt(
                toCompactDateLabel(reminderAt, settings.uiLanguage),
                toArabicTimeLabel(reminderAt, settings.uiLanguage)
              )}
            </Text>
          </SectionCard>

          <SectionCard title={copy.confirmation.recurrence}>
            <View style={[styles.choiceRow, tabletLayout && styles.choiceRowTablet]}>
              {recurrenceOptions.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRecurrence(value)}
                  style={[
                    styles.choiceChip,
                    tabletLayout && styles.choiceChipTablet,
                    value === recurrence && styles.choiceChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      tabletLayout && styles.choiceTextTablet,
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
            <View style={[styles.choiceRow, tabletLayout && styles.choiceRowTablet]}>
              {categoryOptions.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setCategory(value)}
                  style={[
                    styles.choiceChip,
                    tabletLayout && styles.choiceChipTablet,
                    value === category && styles.choiceChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      tabletLayout && styles.choiceTextTablet,
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
            <View style={[styles.inlineCalendarHint, tabletLayout && styles.inlineCalendarHintTablet]}>
              <Text
                style={[
                  styles.inlineCalendarHintText,
                  tabletLayout && styles.inlineCalendarHintTextTablet,
                ]}
              >
                {copy.confirmation.iosCalendarHint}
              </Text>
            </View>
          ) : null}

          <SectionCard title="منبه قوي (AlarmKit)">
            <View style={[styles.calendarRow, tabletLayout && styles.calendarRowTablet]}>
              <Pressable
                onPress={() => setIsAlarm((current) => !current)}
                style={[
                  styles.calendarToggle,
                  isAlarm && styles.calendarToggleActive,
                ]}
              >
                <View
                  style={[
                    styles.calendarToggleKnob,
                    isAlarm && styles.calendarToggleKnobActive,
                  ]}
                />
              </Pressable>
              <View style={styles.calendarText}>
                <Text style={[styles.calendarTitle, tabletLayout && styles.calendarTitleTablet]}>
                  تفعيل رنين المنبه
                </Text>
                <Text style={[styles.calendarHint, tabletLayout && styles.calendarHintTablet]}>
                  سيقوم الهاتف بالرنين بصوت عالٍ حتى لو كان صامتاً.
                </Text>
              </View>
            </View>
          </SectionCard>

          {showAndroidCalendarToggle ? (
            <SectionCard title={copy.confirmation.calendar} subtitle={calendarSubtitle}>
              <View style={[styles.calendarRow, tabletLayout && styles.calendarRowTablet]}>
                <Pressable
                  onPress={() => setAddToCalendar((current) => !current)}
                  style={[
                    styles.calendarToggle,
                    addToCalendar && styles.calendarToggleActive,
                  ]}
                >
                  <View
                    style={[
                      styles.calendarToggleKnob,
                      addToCalendar && styles.calendarToggleKnobActive,
                    ]}
                  />
                </Pressable>
                <View style={styles.calendarText}>
                  <Text style={[styles.calendarTitle, tabletLayout && styles.calendarTitleTablet]}>
                    {copy.confirmation.addToCalendar}
                  </Text>
                  <Text style={[styles.calendarHint, tabletLayout && styles.calendarHintTablet]}>
                    {copy.confirmation.calendarHint}
                  </Text>
                </View>
              </View>
            </SectionCard>
          ) : null}
        </>
      )}

      {validationError ? (
        <Text style={[styles.errorText, tabletLayout && styles.errorTextTablet]}>
          {validationError}
        </Text>
      ) : null}

      {useCompactLayout ? (
        <View style={[styles.manualFooter, tabletLayout && styles.manualFooterTablet]}>
          <GhostButton
            label={saving ? copy.confirmation.saving : copy.confirmation.saveReminder}
            onPress={handleSave}
            disabled={saving}
          />
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.inlineBackAction, tabletLayout && styles.inlineBackActionTablet]}
          >
            <Text style={[styles.inlineBackText, tabletLayout && styles.inlineBackTextTablet]}>
              {copy.common.back}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.footer, tabletLayout && styles.footerTablet]}>
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
      )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
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
    fontSize: 20,
    color: colors.text,
    maxWidth: 260,
  },
  titleTablet: {
    fontSize: 28,
    lineHeight: 40,
    maxWidth: 420,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  subtitleTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  heroCard: {
    borderRadius: radii.lg,
  },
  heroCardContent: {
    padding: 18,
    gap: spacing.xs,
  },
  heroCardContentTablet: {
    padding: spacing.xl,
    gap: spacing.sm,
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
  heroLabelTablet: {
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  heroValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroValueTablet: {
    fontSize: 28,
    lineHeight: 40,
  },
  heroCaption: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  heroCaptionTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  compactCard: {
    borderRadius: radii.lg,
  },
  compactCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  compactCardContentTablet: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  compactBlock: {
    gap: spacing.xs,
  },
  compactLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  compactLabelTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  compactSummary: {
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  compactSummaryTablet: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  compactSummaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  compactSummaryLabelTablet: {
    fontSize: 15,
  },
  compactSummaryText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  compactSummaryTextTablet: {
    fontSize: 17,
    lineHeight: 28,
  },
  moreOptionsToggle: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  moreOptionsToggleTablet: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  moreOptionsToggleText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  moreOptionsToggleTextTablet: {
    fontSize: 15,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  optionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  optionLabelTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  bodyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  bodyTextTablet: {
    fontSize: 17,
    lineHeight: 28,
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
  inputTablet: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    fontSize: 19,
  },
  pickerWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  pickerHeaderTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pickerHeaderTitleTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  pickerDoneChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(108,92,231,0.10)',
  },
  pickerDoneText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  pickerDoneTextTablet: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  rowTablet: {
    gap: spacing.md,
  },
  fieldChip: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  fieldChipTablet: {
    padding: spacing.lg,
  },
  fieldChipLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldChipLabelTablet: {
    fontSize: 15,
  },
  fieldChipValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldChipValueTablet: {
    fontSize: 19,
    lineHeight: 30,
  },
  choiceRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceRowTablet: {
    gap: spacing.md,
  },
  choiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  choiceChipTablet: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  choiceChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceChipCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  choiceText: {
    fontFamily: fonts.semibold,
    color: colors.text,
    writingDirection: 'rtl',
  },
  choiceTextTablet: {
    fontSize: 16,
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
  errorTextTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  calendarRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  calendarRowTablet: {
    gap: spacing.lg,
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
  calendarTitleTablet: {
    fontSize: 20,
    lineHeight: 30,
  },
  calendarHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  calendarHintTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  inlineCalendarHint: {
    backgroundColor: '#F2F7F6',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#D5E7E0',
  },
  inlineCalendarHintTablet: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inlineCalendarHintText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  inlineCalendarHintTextTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  footer: {
    gap: spacing.md,
  },
  footerTablet: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  manualFooter: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  manualFooterTablet: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  inlineBackAction: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inlineBackActionTablet: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  inlineBackText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  inlineBackTextTablet: {
    fontSize: 16,
  },
});
