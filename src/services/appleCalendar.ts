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
    await nativeAppleCalendar.requestWriteAccess();
    const freshStatus = await getAppleCalendarAuthorizationStatus();
    return {
      granted: canAutoSyncToAppleCalendar(freshStatus),
      status: freshStatus,
    };
  } catch {
    const freshStatus = await getAppleCalendarAuthorizationStatus();
    return {
      granted: canAutoSyncToAppleCalendar(freshStatus),
      status: freshStatus,
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
    if (__DEV__) {
      console.info('Apple Calendar save result', {
        title: input.title,
        startDate: input.startDate,
        status: result.status,
        eventId: result.eventId ?? null,
        authorizationStatus: result.authorizationStatus ?? null,
      });
    }
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
    if (__DEV__) {
      console.info('Apple Calendar delete skipped before native call', {
        available: isAppleCalendarAvailable(),
        hasModule: Boolean(nativeAppleCalendar),
        eventId,
      });
    }
    return {
      status: 'skipped',
      provider: 'apple',
    };
  }

  try {
    if (__DEV__) {
      console.info('Apple Calendar delete invoking native bridge', {
        eventId,
      });
    }
    const result = await nativeAppleCalendar.deleteEvent(eventId);
    if (__DEV__) {
      console.info('Apple Calendar delete native result', {
        eventId,
        status: result.status,
        authorizationStatus: result.authorizationStatus ?? null,
      });
    }
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
