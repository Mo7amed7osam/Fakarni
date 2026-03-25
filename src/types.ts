export type Recurrence = 'none' | 'daily' | 'weekly' | 'weekdays';
export type ReminderStatus = 'scheduled' | 'done' | 'missed';
export type ParseSource = 'rules' | 'hybrid' | 'llm';
export type GhostMode = 'sassy' | 'coach' | 'mom' | 'calm';
export type UiLanguage = 'ar-EG' | 'en';
export type ReminderNotificationStatus = 'scheduled' | 'permission_required';
export type NotificationPermissionState = 'granted' | 'undetermined' | 'blocked';
export type CalendarProvider = 'apple' | 'google' | 'device';
export type CalendarSyncStatus = 'none' | 'pending' | 'synced' | 'failed' | 'skipped';
export type AdsProvider = 'none' | 'admob';
export interface AnalyticsSettingsState {
  enabled: boolean;
  consentShown: boolean;
}

export interface AdsSettingsState {
  enabled: boolean;
  provider: AdsProvider;
  homeBannerEnabled: boolean;
  interstitialEveryActions: number;
  hideAdsForFutureSubscribers: boolean;
}

export type AppleCalendarPermissionStatus =
  | 'not_supported'
  | 'not_determined'
  | 'denied'
  | 'restricted'
  | 'authorized'
  | 'write_only'
  | 'full_access';
export type ReminderCategory =
  | 'study'
  | 'work'
  | 'meeting'
  | 'health'
  | 'shopping'
  | 'finance'
  | 'personal'
  | 'other';

export interface Reminder {
  id: string;
  title: string;
  category: ReminderCategory;
  originalTranscript: string;
  eventAt: string;
  remindAt: string;
  offsetMinutes: number;
  recurrence: Recurrence;
  status: ReminderStatus;
  createdAt: string;
  notificationId?: string;
  notificationIds?: string[];
  notificationStatus: ReminderNotificationStatus;
  snoozedNotificationId?: string;
  followUpNotificationId?: string;
  followUpForAt?: string;
  completedAt?: string;
  snoozedUntil?: string;
  lastTriggeredAt?: string;
  followUpCount: number;
  calendarSyncStatus: CalendarSyncStatus;
  calendarProvider?: CalendarProvider;
  calendarEventId?: string;
}

export interface ReminderMutationResult {
  ok: boolean;
  reason?: string;
  warning?: string;
}

export interface CalendarEventResult {
  status: CalendarSyncStatus;
  provider?: CalendarProvider;
  eventId?: string;
}

export interface ParseResult {
  title: string;
  eventAt: string | null;
  remindAt: string | null;
  categorySuggestion: ReminderCategory;
  offsetMinutes: number;
  confidence: number;
  needsConfirmation: boolean;
  missingFields: string[];
  recurrenceSuggestion?: Recurrence;
  source: ParseSource;
}

export interface UsageState {
  dateKey: string;
  createdCount: number;
  isProMock: boolean;
  installAt: string;
  firstReminderCreatedAt?: string;
  firstVoiceReminderCreatedAt?: string;
}

export interface GoogleCalendarConnection {
  connected: boolean;
  email?: string;
}

export interface AppleCalendarConnection {
  autoSyncEnabled: boolean;
  permissionStatus: AppleCalendarPermissionStatus;
}

export interface SettingsState {
  uiLanguage: UiLanguage;
  ttsEnabled: boolean;
  hasSeenOnboarding: boolean;
  ghostMode: GhostMode;
  followUpEnabled: boolean;
  followUpDelayMinutes: number;
  appleCalendar: AppleCalendarConnection;
  googleCalendar: GoogleCalendarConnection;
  analytics: AnalyticsSettingsState;
  ads: AdsSettingsState;
}

export interface PersistedState {
  reminders: Reminder[];
  usageState: UsageState;
  settings: SettingsState;
}

export interface ReminderDraft {
  title: string;
  category: ReminderCategory;
  eventAt: string;
  offsetMinutes: number;
  recurrence: Recurrence;
  addToCalendar?: boolean;
}

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
  Confirmation: {
    mode: 'create' | 'edit';
    draft: ReminderDraft;
    transcript: string;
    confidence: number;
    missingFields: string[];
    reminderId?: string;
  };
  ReminderList: undefined;
  Settings: undefined;
  FounderDashboard: undefined;
  HelpFaq: undefined;
  SpeechFailed: {
    transcript?: string;
    reason: string;
  };
};
