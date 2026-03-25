import * as AuthSession from 'expo-auth-session';
import * as Calendar from 'expo-calendar';
import * as SecureStore from 'expo-secure-store';
import dayjs from 'dayjs';
import { Platform } from 'react-native';
import { saveToAppleCalendar } from './appleCalendar';
import {
  CalendarEventResult,
  CalendarProvider,
  GoogleCalendarConnection,
} from '../types';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GOOGLE_CALENDAR_CREDENTIALS_KEY = '@voiceghost/google-calendar-creds';
const GOOGLE_CALENDAR_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
} as const;

const googleCalendarClientIds = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ANDROID_CLIENT_ID,
} as const;

export interface GoogleCalendarCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface CalendarEventInput {
  title: string;
  date: string;
  endDate?: string;
  reminderOffset: number;
  platform?: 'ios' | 'android';
  googleCalendar?: GoogleCalendarConnection;
}

export function isGoogleCalendarConfigured() {
  return Boolean(googleCalendarClientIds.ios || googleCalendarClientIds.android);
}

export function getGoogleCalendarAuthConfig() {
  return {
    iosClientId: googleCalendarClientIds.ios,
    androidClientId: googleCalendarClientIds.android,
  };
}

export function getGoogleCalendarScope() {
  return GOOGLE_CALENDAR_SCOPE;
}

export function getGoogleCalendarDiscovery() {
  return GOOGLE_CALENDAR_DISCOVERY;
}

export async function saveGoogleCalendarCredentials(credentials: GoogleCalendarCredentials) {
  await SecureStore.setItemAsync(
    GOOGLE_CALENDAR_CREDENTIALS_KEY,
    JSON.stringify(credentials)
  );
}

export async function getStoredGoogleCalendarCredentials() {
  const raw = await SecureStore.getItemAsync(GOOGLE_CALENDAR_CREDENTIALS_KEY);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as GoogleCalendarCredentials;
}

export async function clearGoogleCalendarCredentials() {
  await SecureStore.deleteItemAsync(GOOGLE_CALENDAR_CREDENTIALS_KEY);
}

export async function fetchGoogleCalendarProfile(accessToken: string) {
  const response = await fetch(GOOGLE_CALENDAR_DISCOVERY.userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google profile request failed with status ${response.status}`);
  }

  const json = (await response.json()) as {
    email?: string;
  };

  return {
    email: json.email,
  };
}

function buildEventDates(input: CalendarEventInput) {
  const startDate = new Date(input.date);
  const endDate = input.endDate
    ? new Date(input.endDate)
    : dayjs(input.date).add(30, 'minute').toDate();

  return {
    startDate,
    endDate,
  };
}

function buildDeviceCalendarEvent(input: CalendarEventInput) {
  const { startDate, endDate } = buildEventDates(input);

  return {
    title: input.title,
    startDate,
    endDate,
    notes: 'Created by Fakarni',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms:
      input.reminderOffset > 0
        ? [
            {
              relativeOffset: -input.reminderOffset,
            },
          ]
        : [],
  };
}

async function getWritableCalendarId(platform: 'ios' | 'android') {
  if (platform === 'ios') {
    const calendar = await Calendar.getDefaultCalendarAsync();
    return calendar.id;
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable =
    calendars.find((calendar) => calendar.allowsModifications && calendar.isPrimary) ??
    calendars.find((calendar) => calendar.allowsModifications);

  return writable?.id;
}

async function createDeviceCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEventResult> {
  const platform = input.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android');
  if (platform === 'ios') {
    return saveToAppleCalendar({
      title: input.title,
      startDate: input.date,
      endDate: input.endDate,
      reminderOffsetMinutes: input.reminderOffset,
    });
  }

  const provider: CalendarProvider = 'device';
  const eventData = buildDeviceCalendarEvent(input);

  try {
    const existingPermission = await Calendar.getCalendarPermissionsAsync();

    if (existingPermission.granted) {
      const calendarId = await getWritableCalendarId(platform);
      if (!calendarId) {
        return {
          status: 'skipped',
          provider,
        };
      }

      const eventId = await Calendar.createEventAsync(calendarId, eventData);
      return {
        status: 'synced',
        provider,
        eventId,
      };
    }

    const requestedPermission = await Calendar.requestCalendarPermissionsAsync();
    if (!requestedPermission.granted) {
      return {
        status: 'skipped',
        provider,
      };
    }

    const calendarId = await getWritableCalendarId(platform);
    if (!calendarId) {
      return {
        status: 'skipped',
        provider,
      };
    }

    const eventId = await Calendar.createEventAsync(calendarId, eventData);
    return {
      status: 'synced',
      provider,
      eventId,
    };
  } catch {
    return {
      status: 'failed',
      provider,
    };
  }
}

function getGoogleClientId(platform: 'ios' | 'android') {
  return platform === 'ios'
    ? googleCalendarClientIds.ios
    : googleCalendarClientIds.android;
}

async function getValidGoogleAccessToken(platform: 'ios' | 'android') {
  const credentials = await getStoredGoogleCalendarCredentials();
  if (!credentials?.accessToken) {
    return null;
  }

  if (!credentials.expiresAt || credentials.expiresAt > Date.now() + 60_000) {
    return credentials.accessToken;
  }

  if (!credentials.refreshToken) {
    return null;
  }

  const clientId = getGoogleClientId(platform);
  if (!clientId) {
    return null;
  }

  try {
    const refreshed = await AuthSession.refreshAsync(
      {
        clientId,
        refreshToken: credentials.refreshToken,
      },
      GOOGLE_CALENDAR_DISCOVERY
    );

    const nextCredentials: GoogleCalendarCredentials = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? credentials.refreshToken,
      expiresAt: Date.now() + (refreshed.expiresIn ?? 3600) * 1000,
    };

    await saveGoogleCalendarCredentials(nextCredentials);
    return nextCredentials.accessToken;
  } catch {
    return null;
  }
}

async function createGoogleCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEventResult> {
  const platform = input.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android');
  const accessToken = await getValidGoogleAccessToken(platform);
  if (!accessToken) {
    return {
      status: 'skipped',
      provider: 'google',
    };
  }

  const { startDate, endDate } = buildEventDates(input);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: input.title,
          start: {
            dateTime: startDate.toISOString(),
            timeZone,
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone,
          },
          reminders: {
            useDefault: false,
            overrides:
              input.reminderOffset > 0
                ? [
                    {
                      method: 'popup',
                      minutes: input.reminderOffset,
                    },
                  ]
                : [],
          },
        }),
      }
    );

    if (!response.ok) {
      return {
        status: 'failed',
        provider: 'google',
      };
    }

    const json = (await response.json()) as {
      id?: string;
    };

    return {
      status: 'synced',
      provider: 'google',
      eventId: json.id,
    };
  } catch {
    return {
      status: 'skipped',
      provider: 'google',
    };
  }
}

export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEventResult> {
  const platform = input.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android');

  if (
    platform === 'android' &&
    input.googleCalendar?.connected &&
    isGoogleCalendarConfigured()
  ) {
    return createGoogleCalendarEvent({
      ...input,
      platform,
    });
  }

  return createDeviceCalendarEvent({
    ...input,
    platform,
  });
}
