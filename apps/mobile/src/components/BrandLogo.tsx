import { Image, type ImageStyle } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { brandColors } from '../theme/tokens';
import type { Brand } from '../types/db';

/** 1–2 letter monogram: initials of the first two words, or first two letters
 * of a single-word name. "Nishat Linen" → NL, "Khaadi" → KH, "BEECHTREE" → BE. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Brand logo chip: renders logo_url when present, else a §9 brand-color tile
 * with a clean monogram (never a truncated full name). Scales the monogram to
 * the tile so it reads at both feed-pin (small) and brand-page (large) sizes.
 */
export function BrandLogo({
  brand,
  width = 52,
  height = 34,
  style,
}: {
  brand: Pick<Brand, 'slug' | 'name' | 'logo_url'>;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const fallback = brandColors[brand.slug] ?? { bg: '#111111', fg: '#FFFFFF' };
  if (brand.logo_url) {
    return (
      <Image
        source={{ uri: brand.logo_url }}
        style={[{ width, height, borderRadius: 9 }, styles.border, style as StyleProp<ImageStyle>]}
        contentFit="contain"
      />
    );
  }
  const fontSize = Math.round(Math.min(height * 0.5, width * 0.42));
  return (
    <View
      style={[
        { width, height, borderRadius: 9, backgroundColor: fallback.bg },
        styles.tile,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: fallback.fg, fontSize, fontWeight: '800', letterSpacing: 1 }}
      >
        {monogram(brand.name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  border: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', backgroundColor: '#FFF' },
  tile: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
