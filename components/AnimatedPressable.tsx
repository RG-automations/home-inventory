import { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PRESS_TIMING_CONFIG } from '../lib/press';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  /** O ile zmniejszyc element na dotkniecie. Domyslnie 0.96 — subtelne, nie zaklocajace layoutu. */
  pressedScale?: number;
};

/**
 * Pressable z wbudowanym feedbackiem na dotkniecie (apple-design zasada #1:
 * odpowiedz natychmiast na pointer-down, nie na puszczenie). Uzywa
 * Reanimated (nie CSS-transition-only stylow), wiec animacja dziala
 * identycznie na web, iOS i Android — RN natywnie ignoruje transitionProperty
 * i podobne klucze CSS, wiec ta wersja jest jedynym sposobem na plynny
 * feedback na telefonie.
 */
export default function AnimatedPressable({ style, pressedScale = 0.96, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      scale.value = withTiming(pressedScale, PRESS_TIMING_CONFIG);
      onPressIn?.(event);
    },
    [scale, pressedScale, onPressIn],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      scale.value = withTiming(1, PRESS_TIMING_CONFIG);
      onPressOut?.(event);
    },
    [scale, onPressOut],
  );

  return (
    <AnimatedPressableBase
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
