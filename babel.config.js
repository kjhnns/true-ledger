module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Enable file-based routing for expo-router
      'expo-router/babel',
      // Must be last for react-native-reanimated
      'react-native-reanimated/plugin',
    ],
  };
};
