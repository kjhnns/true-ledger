import { MD3LightTheme } from 'react-native-paper';

export const bwTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#000000',
    onPrimary: '#FFFFFF',
    secondary: '#000000',
    onSecondary: '#FFFFFF',

    background: '#FFFFFF',
    surface: '#FFFFFF',
    onSurface: '#000000',

    outline: '#000000',
    outlineVariant: '#808080',

    surfaceVariant: '#F5F5F5',
    onSurfaceVariant: '#000000',

    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FFFFFF',
      level3: '#FFFFFF',
      level4: '#FFFFFF',
      level5: '#FFFFFF',
    },
  },
  roundness: 4,
} as const;

export type BWTheme = typeof bwTheme;
