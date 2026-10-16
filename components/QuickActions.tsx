import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AccountSettingsModal from './AccountSettingsModal';
import AnimatedPressable from './AnimatedPressable';
import LanguagePicker from './LanguagePicker';
import type { Theme } from '../lib/theme';
import { useTheme, useThemePreference, type ThemePreference } from '../lib/theme-context';

const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const PREFERENCE_ICON: Record<ThemePreference, string> = {
  system: '🖥️',
  light: '☀️',
  dark: '🌙',
};

/**
 * Trzy ikony dostepne z kazdego ekranu: jezyk, motyw, ustawienia konta.
 * Uzywane w glownym pasku (AppHeader) oraz w naglowkach pelnoekranowych
 * modali, ktore zaslaniaja glowny pasek.
 */
export default function QuickActions() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isLanguagePickerVisible, setIsLanguagePickerVisible] = useState(false);
  const [isAccountSettingsVisible, setIsAccountSettingsVisible] = useState(false);

  return (
    <View style={styles.row}>
      <AnimatedPressable
        style={styles.iconButton}
        pressedScale={0.92}
        onPress={() => setIsLanguagePickerVisible(true)}
      >
        <Text style={styles.iconButtonText}>🌐</Text>
      </AnimatedPressable>
      <AnimatedPressable
        style={styles.iconButton}
        pressedScale={0.92}
        onPress={() => setPreference(NEXT_PREFERENCE[preference])}
      >
        <Text style={styles.iconButtonText}>{PREFERENCE_ICON[preference]}</Text>
      </AnimatedPressable>
      <AnimatedPressable
        style={styles.iconButton}
        pressedScale={0.92}
        onPress={() => setIsAccountSettingsVisible(true)}
      >
        <Text style={styles.iconButtonText}>⚙️</Text>
      </AnimatedPressable>

      <AccountSettingsModal
        visible={isAccountSettingsVisible}
        onClose={() => setIsAccountSettingsVisible(false)}
      />

      <LanguagePicker
        visible={isLanguagePickerVisible}
        onClose={() => setIsLanguagePickerVisible(false)}
      />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonText: { fontSize: theme.fontSize.md },
  });
}
