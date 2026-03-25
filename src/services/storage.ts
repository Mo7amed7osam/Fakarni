import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistedState } from '../types';

const STORAGE_KEY = '@voiceghost/state';

export async function loadPersistedState() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as PersistedState;
}

export async function savePersistedState(state: PersistedState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearPersistedState() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
