import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Gest musi zaczac sie przy lewej krawedzi — jak natywny swipe-back w iOS. */
const EDGE_ZONE_PX = 60;
/** Minimalna dlugosc przesuniecia, zeby uznac to za gest cofania. */
const MIN_DISTANCE_PX = 60;
/** Maksymalne odchylenie w pionie — odrozniamy swipe od przewijania listy. */
const MAX_VERTICAL_DRIFT_PX = 80;

/**
 * Gest "przesun w prawo, aby sie cofnac" dla Web/PWA.
 *
 * react-native-gesture-handler nie obsluguje gestow na Web, a aplikacja
 * na iPhone dziala jako PWA (czyli technicznie jako strona) — w trybie
 * standalone nie ma tez paska przegladarki z przyciskiem wstecz.
 * Dlatego obslugujemy natywne zdarzenia dotyku.
 */
export function useSwipeBack(onSwipeBack: () => void, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    if (typeof document === 'undefined') return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;

      tracking = touch.clientX <= EDGE_ZONE_PX;
      startX = touch.clientX;
      startY = touch.clientY;
    }

    function handleTouchEnd(event: TouchEvent) {
      if (!tracking) return;
      tracking = false;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);

      if (deltaX >= MIN_DISTANCE_PX && deltaY <= MAX_VERTICAL_DRIFT_PX) {
        onSwipeBack();
      }
    }

    // capture: true — zdarzenie lapiemy w fazie przechwytywania, zanim dotrze
    // do elementow React Native Web (ktore moga je zatrzymac).
    const options = { passive: true, capture: true } as const;

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, options);
      document.removeEventListener('touchend', handleTouchEnd, options);
    };
  }, [onSwipeBack, enabled]);
}
