/**
 * Kapray design tokens — extracted from the approved prototype
 * (docs/kapray-prototype.html) and spec §9. The prototype is the visual
 * source of truth; change values only against it.
 */
import { Platform } from 'react-native';

export const colors = {
  bg: '#FFFFFF',
  ink: '#111111',
  muted: '#767676',
  chip: '#F1F1F1',
  line: '#ECECEC',
  red: '#CC2B1D', // sale / live
  green: '#1C7C46', // stock / new
  tabIdle: '#9A9A9A',
  placeholder: '#EEEEEE',
} as const;

/** Logo fallback colors when a brand has no logo_url (spec §9). */
export const brandColors: Record<string, { bg: string; fg: string }> = {
  nishat: { bg: '#7A1F3D', fg: '#C39749' }, // maroon, gold text
  limelight: { bg: '#111111', fg: '#FFFFFF' },
  sapphire: { bg: '#0E6B5C', fg: '#FFFFFF' },
  khaadi: { bg: '#C2452D', fg: '#FFFFFF' },
  kayseria: { bg: '#8A1538', fg: '#FFFFFF' },
  gulahmed: { bg: '#1C5C34', fg: '#FFFFFF' },
};

export const radii = {
  card: 16,
  chip: 19,
  sheet: 28,
  banner: 20,
  pdpHero: 22,
  badge: 13,
} as const;

/** Wordmark/serif = Georgia (spec §9); UI text = system sans. */
export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' })!,
} as const;

export const layout = {
  pageMargin: 16,
  gutter: 11, // masonry column gap
} as const;

/** Reusable text styles matching the prototype. */
export const type = {
  wordmark: {
    fontFamily: fonts.serif,
    fontWeight: '700' as const,
    letterSpacing: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' as const },
  ctaLabel: {
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase' as const,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  groupLabel: {
    fontSize: 10.5,
    fontWeight: '700' as const,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: colors.muted,
  },
} as const;
