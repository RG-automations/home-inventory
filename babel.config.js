module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin (wymagany od Reanimated 4) MUSI byc ostatni
    // na liscie — przeksztalca funkcje oznaczone jako "worklet" (uruchamiane
    // na osobnym watku UI zamiast JS), a inne pluginy musza juz miec
    // przetworzony kod zanim to sie stanie.
    plugins: ['react-native-worklets/plugin'],
  };
};
