import { usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import AllItemsModal from './AllItemsModal';
import AnimatedPressable from './AnimatedPressable';
import LocationTreeModal from './LocationTreeModal';
import QuickActions from './QuickActions';
import SearchBar from './SearchBar';
import { useAuth } from '../lib/auth-context';
import { getLocationById } from '../lib/locations';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { useSwipeBack } from '../lib/use-swipe-back';

/**
 * Wspolny pasek gorny — widoczny na kazdym ekranie po zalogowaniu
 * (podpiety raz w app/_layout.tsx, nie w poszczegolnych ekranach).
 */
export default function AppHeader() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isAllItemsVisible, setIsAllItemsVisible] = useState(false);
  const [isLocationTreeVisible, setIsLocationTreeVisible] = useState(false);

  // W trybie PWA (ikona z ekranu glownego) nie ma paska przegladarki,
  // wiec bez wlasnego przycisku uzytkownik nie ma jak sie cofnac.
  // Pokazujemy strzalke tylko na podstronach — na ekranie glownym nie ma dokad wracac.
  const isOnHomeScreen = pathname === '/' || pathname === '';

  // Id miejsca odczytane ze sciezki (/location/<id>).
  const currentLocationId = pathname.startsWith('/location/')
    ? pathname.slice('/location/'.length)
    : null;

  /**
   * Cofanie idzie W GORE HIERARCHII MIEJSC, nie po historii przegladarki.
   * Wazne: po skoku ze struktury miejsc albo z wyszukiwarki historia
   * prowadzi na ekran glowny, a uzytkownik oczekuje przejscia do miejsca
   * nadrzednego (np. ze "Szafy" do "Mieszkania", nie na strone glowna).
   */
  const handleBack = useCallback(async () => {
    if (!currentLocationId) {
      router.replace('/');
      return;
    }

    try {
      const location = await getLocationById(currentLocationId);
      router.replace(location.parent_id ? `/location/${location.parent_id}` : '/');
    } catch {
      // Miejsce mogło zostać usunięte — wracamy na ekran glowny.
      router.replace('/');
    }
  }, [currentLocationId, router]);

  // Gest przesuniecia od lewej krawedzi — dziala tylko poza ekranem glownym.
  useSwipeBack(handleBack, !isOnHomeScreen);

  return (
    <View>
      <View style={styles.header}>
        {!isOnHomeScreen && (
          <AnimatedPressable
            style={styles.backButton}
            pressedScale={0.92}
            onPress={handleBack}
            hitSlop={8}
            accessibilityLabel={t('common.back')}
          >
            <Text style={styles.backIcon}>‹</Text>
          </AnimatedPressable>
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {t('common.appName')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {session?.user.email}
          </Text>
        </View>
        <QuickActions />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBarFlex}>
          <SearchBar />
        </View>
        <AnimatedPressable
          style={styles.toolButton}
          pressedScale={0.92}
          onPress={() => setIsAllItemsVisible(true)}
        >
          <Text style={styles.toolButtonIcon}>📋</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.toolButton}
          pressedScale={0.92}
          onPress={() => setIsLocationTreeVisible(true)}
        >
          <Text style={styles.toolButtonIcon}>🗂️</Text>
        </AnimatedPressable>
      </View>

      <AllItemsModal visible={isAllItemsVisible} onClose={() => setIsAllItemsVisible(false)} />

      <LocationTreeModal
        visible={isLocationTreeVisible}
        onClose={() => setIsLocationTreeVisible(false)}
      />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: {
      fontSize: theme.fontSize.xxl,
      color: theme.colors.text,
      // Znak ‹ jest optycznie przesuniety w dol — korekta dla wysrodkowania.
      lineHeight: theme.fontSize.xxl + 2,
      marginTop: -2,
    },
    titleBlock: { flex: 1 },
    title: { fontSize: theme.fontSize.xl, fontWeight: 'bold', color: theme.colors.text },
    subtitle: { fontSize: theme.fontSize.xs, color: theme.colors.textFaint },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
    },
    searchBarFlex: { flex: 1 },
    toolButton: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolButtonIcon: { fontSize: theme.fontSize.xl },
  });
}
