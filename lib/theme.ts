const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  full: 999,
};

const fontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export const lightTheme = {
  mode: 'light' as const,
  colors: {
    background: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#f3f4f6',
    border: '#e5e7eb',
    borderStrong: '#d1d5db',
    text: '#111827',
    textMuted: '#6b7280',
    textFaint: '#9ca3af',
    primary: '#2563eb',
    primaryText: '#ffffff',
    danger: '#dc2626',
    dangerText: '#ffffff',
    warning: '#f59e0b',
    success: '#16a34a',
    overlay: 'rgba(0,0,0,0.4)',
  },
  spacing,
  radius,
  fontSize,
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    background: '#0f1115',
    surface: '#1a1d23',
    surfaceAlt: '#242830',
    border: '#2e333d',
    borderStrong: '#3d434f',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
    textFaint: '#6b7280',
    primary: '#3b82f6',
    primaryText: '#ffffff',
    danger: '#ef4444',
    dangerText: '#ffffff',
    warning: '#fbbf24',
    success: '#22c55e',
    overlay: 'rgba(0,0,0,0.6)',
  },
  spacing,
  radius,
  fontSize,
};

export type Theme = typeof lightTheme | typeof darkTheme;
