import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cdnImage, fmtPrice, offPct } from '../lib/format';
import { useWishlist } from '../lib/wishlist';
import { colors, radii } from '../theme/tokens';
import type { FeedProduct } from '../types/db';
import { BrandLogo } from './BrandLogo';

/** Varying image heights: prototype cycles 225/185/205 by position. */
const HEIGHTS = [225, 185, 205];

/** Masonry feed card ("pin"): image, discount/NEW badge, wishlist heart,
 * brand row, title, price + strikethrough compare-at (spec §7.2). */
export function ProductPin({ product, index }: { product: FeedProduct; index: number }) {
  const router = useRouter();
  const wishlist = useWishlist();
  const v = product.variants[0];
  const off = v ? offPct(v.price, v.compare_at_price) : null;
  const onSale = off != null; // compare-at strictly above price
  const img = product.images[0]?.src;
  const saved = wishlist.has(product.id);
  const currency = product.brand.currency;

  return (
    <Pressable style={styles.pin} onPress={() => router.push(`/product/${product.id}`)}>
      <View style={[styles.imgWrap, { height: HEIGHTS[index % 3] }]}>
        {img ? (
          <Image
            source={{ uri: cdnImage(img, 540) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={150}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noImg]}>
            <Text style={styles.noImgText}>{product.brand.name.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.off}>
          <Text style={[styles.offText, { color: off ? colors.red : colors.green }]}>
            {off ? `-${off}%` : 'NEW'}
          </Text>
        </View>
        <Pressable
          hitSlop={8}
          style={styles.heart}
          onPress={(e) => {
            e.stopPropagation();
            wishlist.toggle(product.id);
          }}
        >
          <Text style={{ fontSize: 13, color: saved ? colors.red : '#333' }}>
            {saved ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.meta}>
        <View style={styles.brandRow}>
          <BrandLogo brand={product.brand} width={26} height={13} />
          <Text style={styles.brandName} numberOfLines={1}>
            {product.brand.name}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {product.title}
        </Text>
        <Text style={styles.price}>
          {v ? fmtPrice(currency, v.price) : ''}
          {onSale ? (
            <Text style={styles.compareAt}>  {fmtPrice(currency, v!.compare_at_price!)}</Text>
          ) : null}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pin: { marginBottom: 16 },
  imgWrap: {
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.placeholder,
  },
  noImg: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE8DA' },
  noImgText: { fontFamily: 'Georgia', fontSize: 13, color: '#A3947C', letterSpacing: 2 },
  off: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 11,
  },
  offText: { fontSize: 9.5, fontWeight: '800' },
  heart: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { paddingTop: 7, paddingHorizontal: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 11, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  title: { fontSize: 11, color: '#3C3C3C', marginTop: 2 },
  price: { fontSize: 12, fontWeight: '700', marginTop: 2, color: colors.ink },
  compareAt: {
    color: '#9A9A9A',
    fontWeight: '400',
    fontSize: 10.5,
    textDecorationLine: 'line-through',
  },
});
