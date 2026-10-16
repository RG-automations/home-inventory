import { Redirect, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppHeader from '../components/AppHeader';
import QuickAddFab from '../components/QuickAddFab';
import '../lib/i18n';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { ConfirmProvider } from '../lib/confirm';
import { DataRefreshProvider } from '../lib/data-refresh';
import { LanguageProvider } from '../lib/language-context';
import { SubscriptionProvider } from '../lib/subscription-context';
import { ThemeProvider, useTheme } from '../lib/theme-context';

function RootNavigation() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const isOnLoginScreen = pathname === '/login';

  if (!session && !isOnLoginScreen) {
    return <Redirect href="/login" />;
  }

  if (session && isOnLoginScreen) {
    return <Redirect href="/" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {!isOnLoginScreen && <AppHeader />}
      {/* Slot sam nie rozciaga sie na dostepna wysokosc — bez tego opakowania
          zawartosc ekranu ma zerowa wysokosc, gdy nad nim jest naglowek. */}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      {!isOnLoginScreen && <QuickAddFab />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ConfirmProvider>
              <DataRefreshProvider>
                <SubscriptionProvider>
                  <RootNavigation />
                </SubscriptionProvider>
              </DataRefreshProvider>
            </ConfirmProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
