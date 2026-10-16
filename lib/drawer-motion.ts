import { Easing } from 'react-native-reanimated';

// Krzywa jak natywne arkusze na iOS — mocniej wyhamowuje pod koniec
// niz standardowy ease-out, dzieki czemu "osiada" bardziej przekonujaco.
const DRAWER_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export const DRAWER_TIMING = { duration: 300, easing: DRAWER_EASING } as const;
