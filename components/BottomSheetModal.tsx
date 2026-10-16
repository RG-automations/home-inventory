import { useEffect } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View, type ModalProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DRAWER_TIMING } from '../lib/drawer-motion';
import { useTheme } from '../lib/theme-context';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = Omit<ModalProps, 'animationType' | 'transparent'> & {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Modal pelnoekranowy/bottom-sheet z wlasna animacja wjazdu (Reanimated),
 * zamiast wbudowanego animationType="slide" z RN — to pozwala uzyc tej
 * samej krzywej (--ease-drawer) na kazdym z 4 arkuszy w apce, zamiast
 * systemowej krzywej platformy (rozna na iOS/Android, mniej "osiadajaca"
 * niz natywne arkusze iOS).
 */
export default function BottomSheetModal({ visible, onClose, children, ...modalProps }: Props) {
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height);

  useEffect(() => {
    const target = visible ? 0 : height;
    // Ogranicz ruch: skok od razu do celu, bez wjazdu/wyjazdu.
    translateY.value = isReducedMotion ? target : withTiming(target, DRAWER_TIMING);
  }, [visible, height, isReducedMotion, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} {...modalProps}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <Animated.View style={[styles.sheet, sheetStyle]}>{children}</Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: { flex: 1 },
});
