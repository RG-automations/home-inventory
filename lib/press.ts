import { Easing } from 'react-native-reanimated';

/**
 * Konfiguracja czasu trwania i krzywej dla feedbacku na dotkniecie —
 * uzywana przez AnimatedPressable (Reanimated withTiming). 120ms/ease-out
 * to ten sam budzet co reszta drobnych interakcji w apce (patrz
 * SWIPE_SPRING_CONFIG w SwipeableRow.tsx dla wiekszych gestow).
 */
export const PRESS_TIMING_CONFIG = {
  duration: 120,
  easing: Easing.out(Easing.ease),
} as const;
