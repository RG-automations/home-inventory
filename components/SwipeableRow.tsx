import { useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
};

const ACTIONS_WIDTH = 160; // 2 przyciski x 80px (nativeEditButton/nativeDeleteButton nizej)
// Ile trzeba przeciagnac wzgledem szerokosci przyciskow, zeby po puszczeniu
// zostaly odsloniete, zamiast wrocic do pozycji zamknietej.
const OPEN_THRESHOLD = ACTIONS_WIDTH * 0.4;
// Sila oporu przy przeciaganiu poza dopuszczalny zakres (rubber-banding,
// zasada #9) — im dalej za granica, tym mniej wiersz podaza za palcem.
const RUBBER_BAND_CONSTANT = 0.55;

function rubberband(overshoot: number, dimension: number) {
  'worklet';
  return (overshoot * dimension * RUBBER_BAND_CONSTANT) / (dimension + RUBBER_BAND_CONSTANT * Math.abs(overshoot));
}

// dampingRatio 1 = krytycznie tlumiona sprezyna, bez odbicia — domyslny wybor
// Apple dla wiekszosci UI (patrz apple-design: damping ratio + response).
// duration to "perceptualna" dlugosc animacji w ms (nie sztywny czas trwania —
// przy koncowej predkosci gestu sprezyna moze osiagnac cel szybciej lub wolniej).
const SWIPE_SPRING_CONFIG = { dampingRatio: 1, duration: 350, reduceMotion: ReduceMotion.System } as const;

// Platform.OS==='web' oznacza WYLACZNIE "kod dziala przez react-native-web",
// a nie "na komputerze z mysza" — aplikacja jako PWA na iPhone tez trafia
// w ta galaz. Rozroznienie robimy przez typ wskaznika: dotyk jest "coarse"
// (maly, niedokladny), mysz jest "fine". To pozwala dac gest ze sprezynami
// telefonom (nawet przez przegladarke/PWA), a klawiature+mysz zostawic
// na wygodnych klikalnych przyciskach.
function hasTouchInput(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export default function SwipeableRow({ onEdit, onDelete, children, style }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (Platform.OS === 'web' && !hasTouchInput()) {
    return (
      <View style={[styles.webRow, style]}>
        <View style={styles.webContent}>{children}</View>
        <Pressable
          style={({ pressed }) => [styles.webActionButton, pressed && styles.webActionPressed]}
          onPress={onEdit}
        >
          <Text style={styles.webActionText}>✏️</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.webActionButton, pressed && styles.webActionPressed]}
          onPress={onDelete}
        >
          <Text style={styles.webActionText}>🗑</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <NativeSwipeableRow onEdit={onEdit} onDelete={onDelete} style={style} t={t} styles={styles}>
      {children}
    </NativeSwipeableRow>
  );
}

function NativeSwipeableRow({
  onEdit,
  onDelete,
  children,
  style,
  t,
  styles,
}: Props & { t: (key: string) => string; styles: ReturnType<typeof createStyles> }) {
  // translateX = biezaca (presentation) pozycja wiersza — sprezyna zawsze
  // rusza z tej wartosci, wiec chwycenie w trakcie animacji (zasada #3)
  // dziala samo z siebie: nowy gest po prostu ustawia nowy target.
  const translateX = useSharedValue(0);
  // Zapamietuje, czy wiersz byl otwarty na poczatku NOWEGO gestu, zeby
  // przeciaganie w lewo z pozycji otwartej dalej odslanialo (zamiast
  // liczyc od zera) — ciaglosc 1:1 z palcem (zasada #2).
  const startX = useSharedValue(0);

  const isReducedMotion = useReducedMotion();
  // Gesture.Pan().onUpdate dziala na watku UI i nie moze niezawodnie
  // odczytac zwyklej wartosci JS z domkniecia przy kolejnych renderach —
  // synchronizujemy ja do shared value, ktory jest bezpieczny do odczytu
  // wewnatrz workletu.
  const reducedMotionShared = useSharedValue(isReducedMotion);
  useEffect(() => {
    reducedMotionShared.value = isReducedMotion;
  }, [isReducedMotion, reducedMotionShared]);

  function close() {
    translateX.value = withSpring(0, SWIPE_SPRING_CONFIG);
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // histereza — najpierw poziomy ruch >10px, zeby nie lapac pionowego scrolla listy
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      const raw = startX.value + event.translationX;
      if (reducedMotionShared.value) {
        // Ogranicz ruch: twardy stop na granicy, bez fizycznego oporu —
        // rubber-band to ruch WIEKSZY niz to, co robi palec, wiec dla
        // uzytkownikow wrazliwych na ruch pomijamy go calkowicie.
        translateX.value = Math.max(-ACTIONS_WIDTH, Math.min(0, raw));
      } else if (raw < -ACTIONS_WIDTH) {
        // Poza dopuszczalnym zakresem [-ACTIONS_WIDTH, 0] wiersz stawia opor
        // zamiast sztywno zatrzymac sie na granicy (rubber-banding, zasada #9).
        translateX.value = -ACTIONS_WIDTH + rubberband(raw + ACTIONS_WIDTH, ACTIONS_WIDTH);
      } else if (raw > 0) {
        translateX.value = rubberband(raw, ACTIONS_WIDTH);
      } else {
        translateX.value = raw;
      }
    })
    .onEnd((event) => {
      // Decyzja "zostaw otwarte czy zamknij" na podstawie kierunku RUCHU
      // (znak predkosci), nie tylko pozycji koncowej — szybki, krotki
      // ruch w lewo powinien otworzyc, nawet jesli nie przekroczyl progu.
      const shouldOpen =
        event.velocityX < -500 || (translateX.value < -OPEN_THRESHOLD && event.velocityX <= 500);

      // Predkosc gestu przekazana do sprezyny (velocity handoff, zasada #5) —
      // animacja koncowa kontynuuje ruch palca zamiast zaczynac od zera.
      translateX.value = withSpring(shouldOpen ? -ACTIONS_WIDTH : 0, {
        ...SWIPE_SPRING_CONFIG,
        velocity: event.velocityX,
      });
    });

  const tapToCloseGesture = Gesture.Tap().onEnd(() => {
    if (translateX.value !== 0) runOnJS(close)();
  });

  // Przesuwamy CALY rzad (tresc + przyciski obok siebie), a nie tylko tresc
  // nad nieruchomymi przyciskami w position:absolute. Powod: react-native-web
  // dodaje kontenerowi FlatList/ScrollView "transform: translateZ(0)" (wymusza
  // kompozycje GPU dla plynnego scrolla — patrz ScrollView/index.js w tej
  // bibliotece), a ta kombinacja z position:absolute na potomku w iOS Safari
  // dawala udokumentowane, widoczne przesuniecie w pionie miedzy elementem
  // position:absolute a elementem w normalnym flow — mimo ze wszystkie
  // zmierzone marginesy/padding/top/bottom byly idealnie zerowe (potwierdzone
  // w DevTools). Rzad o szerokosci tresc+przyciski przesuwany w calosci nie
  // ma tego problemu, bo nic w nim nie jest position:absolute.
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  function handleEdit() {
    close();
    onEdit();
  }

  function handleDelete() {
    close();
    onDelete();
  }

  return (
    <View style={styles.nativeContainer}>
      {/* touchAction="pan-y" (web-only prop) mowi przegladarce, zeby pion
          zostawila natywnemu scrollowi, a JS przechwytywal tylko poziom —
          bez tego iOS Safari/PWA blokowal przewijanie DLUGICH list, bo
          kazdy wiersz mial wlasny gest Pan czekajacy na ruch. To ten sam
          fix, ktory oficjalny komponent Swipeable z tej biblioteki stosuje
          wewnetrznie (patrz react-native-gesture-handler/ReanimatedSwipeable). */}
      <GestureDetector gesture={Gesture.Simultaneous(panGesture, tapToCloseGesture)} touchAction="pan-y">
        <Animated.View style={[styles.row, rowStyle]}>
          <View style={[style, styles.nativeContent]}>{children}</View>
          {/* Przyciski sa CZESCIA tego samego przesuwanego rzedu (nie
              position:absolute) — gdy translateX = -ACTIONS_WIDTH, wjezdzaja
              w widoczny obszar dokladnie tak samo jak tresc go opuszcza. */}
          <View style={styles.nativeActions}>
            <Pressable style={styles.nativeEditButton} onPress={handleEdit}>
              <Text style={styles.nativeActionText}>{t('common.edit')}</Text>
            </Pressable>
            <Pressable style={styles.nativeDeleteButton} onPress={handleDelete}>
              <Text style={styles.nativeActionText}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    webRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    webContent: { flex: 1 },
    webActionButton: {
      width: 36,
      height: 36,
      marginRight: theme.spacing.xs,
      borderRadius: theme.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    webActionPressed: { transform: [{ scale: 0.9 }], backgroundColor: theme.colors.surfaceAlt },
    webActionText: { fontSize: theme.fontSize.md + 2, color: theme.colors.text },
    // overflow:'hidden' przycina rzad (tresc+przyciski, szerszy niz widoczny
    // wiersz) do wlasnej szerokosci — to on wyznacza "okno", w ktorym widac
    // tylko tresc (translateX=0) albo tresc czesciowo zaslonieta przyciskami
    // (translateX=-ACTIONS_WIDTH).
    nativeContainer: { overflow: 'hidden' },
    // Caly przesuwany rzad: tresc (pelna szerokosc wiersza) + przyciski
    // (ACTIONS_WIDTH) obok siebie. Zaden z elementow nie jest position:
    // absolute — to swiadomie unika bledu WebKit opisanego wyzej.
    row: { flexDirection: 'row' },
    // Wiersz musi miec nieprzezroczyste tlo i szerokosc rowna widocznemu
    // oknu (100% kontenera) — przyciski "row" doklejone sa OBOK niej,
    // wiec bez position:absolute i tak nie zaslaniaja tresci, dopoki caly
    // rzad nie zostanie przesuniety w lewo.
    nativeContent: { width: '100%', flexShrink: 0, backgroundColor: theme.colors.background },
    nativeActions: {
      flexDirection: 'row',
      flexShrink: 0,
    },
    nativeEditButton: {
      backgroundColor: theme.colors.warning,
      width: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nativeDeleteButton: {
      backgroundColor: theme.colors.danger,
      width: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nativeActionText: { color: theme.colors.dangerText, fontWeight: '600' },
  });
}
