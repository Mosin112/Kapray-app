import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../../components/BrandLogo';
import { cdnImage, countdown } from '../../lib/format';
import { useBrands, useLiveCampaigns } from '../../lib/queries';
import { colors, radii, type } from '../../theme/tokens';

/** Sales & Drops hub (spec §7.4): featured hero, live campaigns list,
 * "Joining soon" for sync_status != 'live' brands. */
export default function SalesScreen() {
  const router = useRouter();
  const { data: campaigns, isLoading } = useLiveCampaigns();
  const { data: brands } = useBrands();

  const featured = campaigns?.[0];
  const joiningSoon = (brands ?? []).filter((b) => b.sync_status !== 'live');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={[type.wordmark, styles.title]}>SALES & DROPS</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 60 }} />
        ) : (
          <>
            {featured ? (
              <View style={styles.banWrap}>
                <Pressable
                  style={styles.banner}
                  onPress={() => router.push(`/brand/${featured.brand.slug}`)}
                >
                  {featured.hero_image ? (
                    <Image
                      source={{ uri: cdnImage(featured.hero_image, 1080) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      contentPosition="top"
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2B2B2B' }]} />
                  )}
                  <View style={styles.shade} />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>FEATURED</Text>
                  </View>
                  <View style={styles.in}>
                    <Text style={styles.k}>Mid-Summer Sale Season</Text>
                    <Text style={styles.s}>Live across brands · updated hourly</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            <View style={{ marginTop: 10 }}>
              {(campaigns ?? []).map((c) => {
                const ends = c.ends_at ? countdown(c.ends_at) : null;
                return (
                  <Pressable
                    key={c.id}
                    style={styles.saleCard}
                    onPress={() => router.push(`/brand/${c.brand.slug}`)}
                  >
                    <BrandLogo brand={c.brand} width={62} height={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {c.brand.name} — {c.title}
                      </Text>
                      <Text style={styles.cardSub} numberOfLines={1}>
                        Live now{c.subtitle ? ` · ${c.subtitle}` : ''}
                        {ends ? ` · ends in ${ends}` : ''}
                      </Text>
                    </View>
                    <View style={styles.pct}>
                      <Text style={[styles.pctBig, c.kind === 'drop' && { color: colors.green }]}>
                        {c.kind === 'drop' ? 'NEW' : 'SALE'}
                      </Text>
                      <Text style={styles.pctSmall}>{c.kind.toUpperCase()}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {(campaigns ?? []).length === 0 ? (
                <Text style={styles.none}>No live campaigns right now — check back soon.</Text>
              ) : null}
            </View>

            {joiningSoon.length > 0 ? (
              <>
                <Text style={[type.groupLabel, styles.soonHdr]}>Joining soon</Text>
                {joiningSoon.map((b) => (
                  <View key={b.id} style={[styles.saleCard, { opacity: 0.75 }]}>
                    <BrandLogo brand={b} width={62} height={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{b.name}</Text>
                      <Text style={styles.cardSub}>
                        {b.sync_status === 'blocked'
                          ? 'Joining soon'
                          : 'Onboarding — feed integration in progress'}
                      </Text>
                    </View>
                    <View style={styles.pct}>
                      <Text style={[styles.pctBig, { color: '#9A9A9A' }]}>SOON</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 15, textAlign: 'center', paddingTop: 12, paddingBottom: 10 },
  banWrap: { marginHorizontal: 16 },
  banner: { height: 150, borderRadius: radii.banner, overflow: 'hidden', backgroundColor: '#DDD' },
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
  in: { position: 'absolute', bottom: 13, left: 16, right: 16 },
  k: { color: '#FFF', fontFamily: 'Georgia', fontSize: 20 },
  s: {
    color: '#FFF',
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    opacity: 0.9,
    marginTop: 4,
  },
  saleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  cardSub: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  pct: { alignItems: 'flex-end' },
  pctBig: { fontSize: 14, fontWeight: '800', color: colors.red },
  pctSmall: { fontSize: 8.5, letterSpacing: 0.6, color: colors.muted, marginTop: 1 },
  soonHdr: { marginTop: 16, marginBottom: 10, marginHorizontal: 20 },
  none: { textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 30 },
});
