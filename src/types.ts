export type Recurrence = 'none' | 'daily' | 'weekly';
export type ReminderStatus = 'scheduled' | 'done' | 'missed';
export type ParseSource = 'rules' | 'hybrid' | 'llm';
export type GhostMode = 'sassy' | 'coach' | 'mom' | 'calm';
export type ReminderNotificationStatus = 'scheduled' | 'permission_required';
export type NotificationPermissionState = 'granted' | 'undetermined' | 'blocked';
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
  notificationStatus: ReminderNotificationStatus;
}

export interface ReminderMutationResult {
  ok: boolean;
  reason?: string;
  warning?: string;
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
}

export interface SettingsState {
  ttsEnabled: boolean;
  hasSeenOnboarding: boolean;
  ghostMode: GhostMode;
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
  HelpFaq: undefined;
  SpeechFailed: {
    transcript?: string;
    reason: string;
  };
};
