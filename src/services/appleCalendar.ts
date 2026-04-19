import { NativeModules, Platform } from 'react-native';
import {
  AppleCalendarPermissionStatus,
  CalendarDeleteResult,
  CalendarEventResult,
} from '../types';

interface NativePermissionResponse {
  granted: boolean;
  status: AppleCalendarPermissionStatus;
}

interface NativeSaveResponse {
  status:
    | 'saved'
    | 'not_authorized'
    | 'no_calendar'
    | 'invalid_input'
    | 'failed';
  eventId?: string | null;
  authorizationStatus?: AppleCalendarPermissionStatus;
}

interface NativeDeleteResponse {
  status:
    | 'deleted'
    | 'not_authorized'
    | 'not_found'
    | 'invalid_input'
    | 'failed';
  authorizationStatus?: AppleCalendarPermissionStatus;
}

interface NativeAppleCalendarModule {
  getAuthorizationStatus(): Promise<AppleCalendarPermissionStatus>;
  requestWriteAccess(): Promise<NativePermissionResponse>;
  saveEvent(payload: {
    title: string;
    startDate: string;
    endDate?: string;
    reminderOffsetMinutes: number;
  }): Promise<NativeSaveResponse>;
  deleteEvent(eventId: string): Promise<NativeDeleteResponse>;
}

const nativeAppleCalendar = NativeModules.VoiceGhostAppleCalendar as
  | NativeAppleCalendarModule
  | undefined;

export interface SaveToAppleCalendarInput {
  title: string;
  startDate: string;
  endDate?: string;
  reminderOffsetMinutes: number;
}

export function isAppleCalendarAvailable() {
  return Platform.OS === 'ios' && Boolean(nativeAppleCalendar);
}

export function canAutoSyncToAppleCalendar(
  status: AppleCalendarPermissionStatus
) {
  return status === 'authorized' || status === 'write_only' || status === 'full_access';
}

export async function getAppleCalendarAuthorizationStatus(): Promise<AppleCalendarPermissionStatus> {
  if (!isAppleCalendarAvailable() || !nativeAppleCalendar) {
    return 'not_supported';
  }

  try {
    return await nativeAppleCalendar.getAuthorizationStatus();
  } catch {
    return 'not_supported';
  }
}

export async function requestAppleCalendarWriteAccess() {
  if (!isAppleCalendarAvailable() || !nativeAppleCalendar) {
    return {
      granted: false,
      status: 'not_supported' as AppleCalendarPermissionStatus,
    };
  }

  try {
    return await nativeAppleCalendar.requestWriteAccess();
  } catch {
    return {
      granted: false,
      status: await getAppleCalendarAuthorizationStatus(),
    };
  }
}

export async function saveToAppleCalendar(
  input: SaveToAppleCalendarInput
): Promise<CalendarEventResult> {
  if (!isAppleCalendarAvailable() || !nativeAppleCalendar) {
    return {
      status: 'skipped',
      provider: 'apple',
    };
  }

  try {
    const result = await nativeAppleCalendar.saveEvent(input);
    if (result.status === 'saved') {
      return {
        status: 'synced',
        provider: 'apple',
        eventId: result.eventId ?? undefined,
        alertConfigured: true,
      };
    }

    if (
      result.status === 'not_authorized' ||
      result.status === 'no_calendar' ||
      result.status === 'invalid_input'
    ) {
      return {
        status: 'skipped',
        provider: 'apple',
      };
    }

    return {
      status: 'failed',
      provider: 'apple',
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('Apple Calendar save failed', error);
    }

    return {
      status: 'failed',
      provider: 'apple',
    };
  }
}

export async function deleteFromAppleCalendar(
  eventId: string
): Promise<CalendarDeleteResult> {
  if (!isAppleCalendarAvailable() || !nativeAppleCalendar || !eventId.trim()) {
    return {
      status: 'skipped',
      provider: 'apple',
    };
  }

  try {
    const result = await nativeAppleCalendar.deleteEvent(eventId);
    if (result.status === 'deleted') {
      return {
        status: 'deleted',
        provider: 'apple',
      };
    }

    if (
      result.status === 'not_authorized' ||
      result.status === 'not_found' ||
      result.status === 'invalid_input'
    ) {
      return {
        status: 'skipped',
        provider: 'apple',
      };
    }

    return {
      status: 'failed',
      provider: 'apple',
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('Apple Calendar delete failed', error);
    }

    return {
      status: 'failed',
      provider: 'apple',
    };
  }
}
