import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Odczytuje systemowe ustawienie "Ogranicz ruch" (iOS/Android) lub
 * prefers-reduced-motion (web — react-native-web mapuje to samo API na
 * te sama media query pod spodem, wiec ten hook dziala identycznie
 * na wszystkich platformach bez rozgalezien Platform.OS).
 */
export function useReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setIsReduced(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setIsReduced(enabled);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return isReduced;
}
