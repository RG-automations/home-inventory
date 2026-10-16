import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, Text } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import { useAlertInfo } from '../lib/confirm';
import { useLanguage } from '../lib/language-context';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../lib/i18n';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function LanguagePicker({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language, setLanguage } = useLanguage();
  const alertInfo = useAlertInfo();

  async function handleSelect(code: LanguageCode) {
    const needsRestart = setLanguage(code);
    onClose();
    if (needsRestart) {
      await alertInfo(t('common.ok'), t('common.restartRequired'));
    }
  }

  return (
    <Modal visible={visible} transparent animationType={isReducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('common.language')}</Text>
          <FlatList
            data={SUPPORTED_LANGUAGES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <AnimatedPressable style={styles.row} onPress={() => handleSelect(item.code)}>
                <Text style={styles.rowText}>{item.label}</Text>
                {item.code === language && <Text style={styles.checkmark}>✓</Text>}
              </AnimatedPressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      width: '80%',
      maxWidth: 320,
      maxHeight: '70%',
    },
    title: {
      fontSize: theme.fontSize.lg,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowText: { fontSize: theme.fontSize.base, color: theme.colors.text },
    checkmark: { fontSize: theme.fontSize.base, color: theme.colors.primary, fontWeight: '600' },
  });
}
