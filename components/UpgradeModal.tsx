import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import { FREE_LIMITS } from '../lib/subscription';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  visible: boolean;
  /** Ktory limit zostal osiagniety — decyduje o tresci komunikatu. */
  reason: 'items' | 'photos';
  onClose: () => void;
};

export default function UpgradeModal({ visible, reason, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const limit = reason === 'items' ? FREE_LIMITS.items : FREE_LIMITS.photos;

  return (
    <Modal visible={visible} transparent animationType={isReducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>⭐</Text>
          <Text style={styles.title}>{t('upgrade.title')}</Text>
          <Text style={styles.message}>
            {reason === 'items'
              ? t('upgrade.itemsLimitReached', { limit })
              : t('upgrade.photosLimitReached', { limit })}
          </Text>

          <View style={styles.benefits}>
            <Text style={styles.benefit}>{t('upgrade.benefitUnlimited')}</Text>
            <Text style={styles.benefit}>{t('upgrade.benefitPhotos')}</Text>
            <Text style={styles.benefit}>{t('upgrade.benefitSync')}</Text>
          </View>

          <Text style={styles.pricing}>{t('upgrade.pricing')}</Text>
          <Text style={styles.comingSoon}>{t('upgrade.comingSoon')}</Text>

          <AnimatedPressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </AnimatedPressable>
        </View>
      </View>
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
      padding: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
    },
    icon: { fontSize: theme.fontSize.xxxl, marginBottom: theme.spacing.sm },
    title: {
      fontSize: theme.fontSize.lg,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    message: {
      fontSize: theme.fontSize.base,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    benefits: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.xs,
    },
    benefit: { fontSize: theme.fontSize.sm, color: theme.colors.text },
    pricing: {
      fontSize: theme.fontSize.md,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: theme.spacing.xs,
    },
    comingSoon: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textFaint,
      marginBottom: theme.spacing.lg,
      textAlign: 'center',
    },
    closeButton: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    closeButtonText: { color: theme.colors.text, fontWeight: '600' },
  });
}
