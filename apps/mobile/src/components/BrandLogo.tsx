import { Image, type ImageStyle } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { brandColors } from '../theme/tokens';
import type { Brand } from '../types/db';

/**
 * Brand logo chip: renders logo_url when present, else a §9 brand-color
 * wordmark tile (nishat maroon/gold, limelight black, khaadi rust, …).
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
  const fontSize = Math.max(8, Math.min(12, width / (brand.name.length * 0.62)));
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
        style={{ color: fallback.fg, fontSize, fontWeight: '800', letterSpacing: 0.5 }}
      >
        {brand.name.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  border: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', backgroundColor: '#FFF' },
  tile: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
