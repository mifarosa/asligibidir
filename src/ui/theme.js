import { Platform, StyleSheet, useColorScheme } from 'react-native';

const COLORS = {
  light: {
    bg: '#f6f7f9',
    surface: '#ffffff',
    text: '#1c2024',
    muted: '#5d6670',
    border: '#d9dde2',
    accent: '#1f6feb',
    accentText: '#ffffff',
  },
  dark: {
    bg: '#111418',
    surface: '#1a1f25',
    text: '#e6e9ec',
    muted: '#9aa4ae',
    border: '#2d343c',
    accent: '#4c8dff',
    accentText: '#0b0e12',
  },
};

export function useColors() {
  return useColorScheme() === 'dark' ? COLORS.dark : COLORS.light;
}

export const text = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700' },
  h2: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '600' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});

export const layout = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  section: { gap: 8, marginTop: 8 },
});
