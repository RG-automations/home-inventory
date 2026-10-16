import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import QuickAddModal from './QuickAddModal';
import UpgradeModal from './UpgradeModal';
import { useSubscription } from '../lib/subscription-context';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

export default function QuickAddFab() {
  const [isVisible, setIsVisible] = useState(false);
  const [isUpgradeVisible, setIsUpgradeVisible] = useState(false);
  const { canAddItem } = useSubscription();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <AnimatedPressable
        style={styles.fab}
        pressedScale={0.94}
        onPress={() => (canAddItem ? setIsVisible(true) : setIsUpgradeVisible(true))}
        accessibilityLabel="Quick add"
      >
        <Text style={styles.fabIcon}>📷</Text>
      </AnimatedPressable>

      <QuickAddModal
        visible={isVisible}
        onClose={() => setIsVisible(false)}
        onSaved={() => setIsVisible(false)}
      />

      <UpgradeModal
        visible={isUpgradeVisible}
        reason="items"
        onClose={() => setIsUpgradeVisible(false)}
      />
    </>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      bottom: theme.spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    fabIcon: { fontSize: theme.fontSize.xl + 4, color: theme.colors.primaryText },
  });
}
