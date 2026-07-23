import { NativeModules, Platform } from 'react-native';

/**
 * ⚠️ ALARM KIT IS CURRENTLY MOCKED ⚠️
 * 
 * The native iOS implementation of AlarmKit (VoiceGhostAlarmKit) is currently mocked.
 * `getAuthorizationStatus` and `requestAuthorization` return fake positive results.
 * `scheduleAlarm` returns a mock UUID and relies entirely on Local Notifications
 * (via expo-notifications in notifications.ts) to actually alert the user.
 * 
 * Do NOT build UI assumptions around AlarmKit natively succeeding.
 */

const VoiceGhostAlarmKit = NativeModules.VoiceGhostAlarmKit;

export async function getAuthorizationStatus(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !VoiceGhostAlarmKit) return false;
  return VoiceGhostAlarmKit.getAuthorizationStatus();
}

export async function requestAuthorization(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !VoiceGhostAlarmKit) return false;
  return VoiceGhostAlarmKit.requestAuthorization();
}

export async function scheduleAlarm(title: string, date: Date): Promise<string | null> {
  if (Platform.OS !== 'ios' || !VoiceGhostAlarmKit) return null;
  try {
    const alarmId = await VoiceGhostAlarmKit.scheduleAlarm({
      title,
      timestamp: date.getTime(),
    });
    return alarmId;
  } catch (error) {
    console.error('Failed to schedule AlarmKit alarm', error);
    return null;
  }
}

export async function cancelAlarm(alarmId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !VoiceGhostAlarmKit) return false;
  try {
    return await VoiceGhostAlarmKit.cancelAlarm(alarmId);
  } catch (error) {
    console.error('Failed to cancel AlarmKit alarm', error);
    return false;
  }
}
