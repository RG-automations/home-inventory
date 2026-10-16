import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { AsyncAuthStore } from 'pocketbase';
import { Platform } from 'react-native';

// PocketBase wysyla wynik logowania OAuth przez SSE (EventSource). Przegladarka
// ma je wbudowane, natywny React Native nie — dokladamy polyfill.
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (global as unknown as { EventSource: unknown }).EventSource = require('react-native-sse').default;
}

const AUTH_STORAGE_KEY = 'pb_auth';

const pocketbaseUrl = process.env.EXPO_PUBLIC_POCKETBASE_URL!;

const initialAuth = AsyncStorage.getItem(AUTH_STORAGE_KEY);

export const pb = new PocketBase(
  pocketbaseUrl,
  new AsyncAuthStore({
    save: async (serialized) => AsyncStorage.setItem(AUTH_STORAGE_KEY, serialized),
    clear: async () => AsyncStorage.removeItem(AUTH_STORAGE_KEY),
    initial: initialAuth,
  }),
);

/**
 * Rozwiazuje sie, gdy zapisana sesja zostala wczytana z AsyncStorage.
 * AsyncAuthStore sam podpina sie pod `initialAuth` w konstruktorze, wiec nasz
 * `.then` zawsze wykonuje sie juz po wczytaniu stanu.
 */
export const authReady: Promise<void> = initialAuth.then(
  () => undefined,
  () => undefined,
);

/**
 * Zwraca zalogowanego uzytkownika albo rzuca blad.
 * Uzywane przez operacje zapisu, ktore wymagaja pola `user`.
 */
export function getCurrentUserOrThrow() {
  const record = pb.authStore.record;
  if (!pb.authStore.isValid || !record) throw new Error('NOT_AUTHENTICATED');
  return record;
}

// Token dostepu do chronionych plikow. Wazny 1 h (ustawione w kolekcji users,
// patrz pocketbase/pb_migrations), odswiezamy z zapasem.
const FILE_TOKEN_TTL_MS = 50 * 60 * 1000;
let fileToken: { value: string; expiresAt: number } | null = null;
let pendingFileToken: Promise<string> | null = null;

export async function getFileToken(): Promise<string> {
  if (fileToken && fileToken.expiresAt > Date.now()) return fileToken.value;
  if (pendingFileToken) return pendingFileToken;

  pendingFileToken = pb.files
    .getToken()
    .then((value) => {
      fileToken = { value, expiresAt: Date.now() + FILE_TOKEN_TTL_MS };
      return value;
    })
    .finally(() => {
      pendingFileToken = null;
    });

  return pendingFileToken;
}

/** Wywolywane przy wylogowaniu — token nalezy do poprzedniego uzytkownika. */
export function resetFileToken() {
  fileToken = null;
  pendingFileToken = null;
}
