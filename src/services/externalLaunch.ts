import { NativeModules, Platform } from 'react-native';
import {
  ExternalLaunchAction,
  ExternalLaunchSource,
} from '../types';

interface NativePendingExternalLaunch {
  action: ExternalLaunchAction;
  source: ExternalLaunchSource;
  launchNonce: string;
  spokenText?: string;
}

interface NativeExternalLaunchModule {
  consumePendingLaunch(): Promise<NativePendingExternalLaunch | null>;
}

const nativeExternalLaunch = NativeModules.FakarniLaunchBridge as
  | NativeExternalLaunchModule
  | undefined;

export async function consumePendingExternalLaunch() {
  if (Platform.OS !== 'ios' || !nativeExternalLaunch) {
    return null;
  }

  try {
    return await nativeExternalLaunch.consumePendingLaunch();
  } catch {
    return null;
  }
}
