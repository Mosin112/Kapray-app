import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cdnImage, countdown } from '../lib/format';
import { colors, radii } from '../theme/tokens';
import type { CampaignWithBrand } from '../types/db';

const ROTATE_MS = 4000; // prototype auto-rotates every 4s

/** Home campaign carousel: live campaigns, SALE LIVE / NEW DROP badge,
 * countdown for ends_at, dot indicators, auto-rotate (spec §7.2). */
export function CampaignBanner({ campaigns }: { campaigns: CampaignWithBrand[] }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [, setTick] = useState(0); // re-render each second for the countdown

  useEffect(() => {
    if (campaigns.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % campaigns.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [campaigns.length]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (campaigns.length === 0) return null;
  const c = campaigns[Math.min(idx, campaigns.length - 1)];
  const isDrop = c.kind === 'drop';
  const ends = c.ends_at ? countdown(c.ends_at) : null;

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.banner} onPress={() => router.push(`/brand/${c.brand.slug}`)}>
        {c.hero_image ? (
          <Image
            source={{ uri: cdnImage(c.hero_image, 1080) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2B2B2B' }]} />
        )}
        <View style={styles.shade} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{isDrop ? 'NEW DROP' : 'SALE LIVE'}</Text>
        </View>
        {ends ? (
          <View style={styles.cnt}>
            <Text style={styles.cntText}>Ends in {ends}</Text>
          </View>
        ) : null}
        <View style={styles.in}>
          <Text style={styles.k} numberOfLines={2}>
            {c.brand.name} — {c.title}
          </Text>
          {c.subtitle ? <Text style={styles.s}>{c.subtitle}</Text> : null}
        </View>
      </Pressable>
      <View style={styles.dots}>
        {campaigns.map((_, j) => (
          <View key={j} style={[styles.dot, j === idx && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  banner: {
    height: 150,
    borderRadius: radii.banner,
    overflow: 'hidden',
    backgroundColor: '#DDD',
  },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.30)' },
  badge: {
    position: 'absolute',
    top: 12,
    left: 14,
    backgroundColor: colors.red,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.badge,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  cnt: {
    position: 'absolute',
    top: 12,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.badge,
  },
  cntText: { color: '#FFF', fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  in: { position: 'absolute', bottom: 13, left: 16, right: 16 },
  k: { color: '#FFF', fontFamily: 'Georgia', fontSize: 20, lineHeight: 23 },
  s: {
    color: '#FFF',
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    opacity: 0.9,
    marginTop: 4,
  },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D2D2D2' },
  dotOn: { backgroundColor: colors.ink, width: 14 },
});
