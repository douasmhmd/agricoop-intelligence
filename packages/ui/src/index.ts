/*
 * @agricoop/ui — the AgriCoop design system, shared by apps/web and apps/backoffice.
 *
 *   import { Button, Card, ThemeProvider } from '@agricoop/ui';
 *   import { fadeUp, stagger, revealViewport } from '@agricoop/ui/motion';
 *   import '@agricoop/ui/fonts';             // once, in main.tsx
 *   @import '@agricoop/ui/theme.css';        // in the app's index.css (see theme.css)
 *
 * Shipped as TypeScript source: the apps' Vite builds compile it (no build step of its own).
 */
export * from './components/accordion';
export * from './components/badge';
export * from './components/brand';
export * from './components/button';
export * from './components/card';
export * from './components/command';
export * from './components/dialog';
export * from './components/dropdown-menu';
export * from './components/input';
export * from './components/auth-screen';
export * from './components/floating-input';
export * from './components/label';
export * from './components/picture';
export * from './components/sheet';
export * from './components/skeleton';
export * from './components/switch';
export * from './components/table';
export * from './components/tabs';
export * from './components/toaster';
export { cn } from './lib/cn';
export { useDirection } from './lib/direction';
export {
  MotionProvider,
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  ThemeProvider,
  type ThemePreference,
  type ResolvedTheme,
  useTheme,
} from './lib/theme';
