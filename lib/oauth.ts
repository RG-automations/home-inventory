import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { pb } from './pocketbase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Logowanie przez Google. PocketBase prowadzi caly przeplyw sam: otwieramy
 * adres autoryzacji, a wynik wraca do aplikacji przez polaczenie SSE
 * (na Web to okno popup, natywnie przegladarka systemowa).
 *
 * Wymaga dodania `https://{adres PocketBase}/api/oauth2-redirect` jako
 * dozwolonego adresu przekierowania w kliencie Google Cloud.
 */
export async function signInWithGoogle() {
  const users = pb.collection('users');

  if (Platform.OS === 'web') {
    await users.authWithOAuth2({ provider: 'google' });
    return;
  }

  await users.authWithOAuth2({
    provider: 'google',
    urlCallback: async (url) => {
      await WebBrowser.openAuthSessionAsync(url);
    },
  });
}
