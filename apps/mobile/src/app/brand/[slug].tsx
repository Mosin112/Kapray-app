import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../../components/BrandLogo';
import { EmptyState } from '../../components/EmptyState';
import { ProductPin } from '../../components/ProductPin';
import { cdnImage } from '../../lib/format';
import { useBrands, useFeedProducts, useLiveCampaigns } from '../../lib/queries';
import { colors, layout, radii, type } from '../../theme/tokens';

export default function BrandScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { data: brands } = useBrands();
  const { data: products, isLoading } = useFeedProducts();
  const { data: campaigns } = useLiveCampaigns();

  const brand = brands?.find((b) => b.slug === slug);
  const list = useMemo(
    () => (products ?? []).filter((p) => p.brand.slug === slug),
    [products, slug],
  );
  const campaign = campaigns?.find((c) => c.brand.slug === slug);

  if (isLoading || !brand) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.ink} />
      </SafeAreaView>
    );
  }

  const header = (
    <View>
      <View style={styles.backH}>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={[type.wordmark, { fontSize: 15 }]}>KAPRAY</Text>
        <View style={{ width: 18 }} />
      </View>

      <View style={styles.hero}>
        <BrandLogo brand={brand} width={130} height={56} />
        <Text style={styles.h2}>{brand.name}</Text>
        <Text style={styles.sub}>
          {brand.domain} · {list.length} live products
          {campaign ? ` · ${campaign.title} on now` : ''}
        </Text>
        <View style={styles.btns}>
          {/* Follow lands with auth in Phase 3 — visible but explains itself. */}
          <Pressable style={styles.f1}>
            <Text style={styles.f1Text}>Follow +</Text>
          </Pressable>
          <Pressable
            style={styles.f2}
            onPress={() =>
              router.push({
                pathname: '/buy',
                params: { url: brand.base_url, brandName: brand.name, domain: brand.domain, brandId: brand.id },
              })
            }
          >
            <Text style={styles.f2Text}>Visit site ↗</Text>
          </Pressable>
        </View>
      </View>

      {campaign ? (
        <View style={styles.banWrap}>
          <View style={styles.banner}>
            {campaign.hero_image ? (
              <Image
                source={{ uri: cdnImage(campaign.hero_image, 1080) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="top"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2B2B2B' }]} />
            )}
            <View style={styles.shade} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {campaign.kind === 'drop' ? 'NEW DROP' : 'SALE LIVE'}
              </Text>
            </View>
            <View style={styles.in}>
              <Text style={styles.k}>{campaign.title}</Text>
              {campaign.subtitle ? <Text style={styles.s}>{campaign.subtitle}</Text> : null}
            </View>
          </View>
        </View>
      ) : null}
      <View style={{ height: 12 }} />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlashList
        masonry
        numColumns={2}
        data={list}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => (
          <View style={styles.cell}>
            <ProductPin product={item} index={index} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title={brand.sync_status === 'live' ? 'No products yet' : 'Joining soon'}
            body={
              brand.sync_status === 'live'
                ? 'The next catalog sync will fill this in.'
                : `${brand.name} is onboarding — products appear when their feed goes live.`
            }
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  backH: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  hero: { alignItems: 'center', paddingTop: 20, paddingBottom: 4 },
  h2: {
    fontFamily: 'Georgia',
    fontSize: 20,
    letterSpacing: 2.5,
    marginTop: 10,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  sub: { fontSize: 10.5, color: colors.muted, marginTop: 4 },
  btns: { flexDirection: 'row', gap: 8, marginTop: 13, marginBottom: 4 },
  f1: { backgroundColor: colors.ink, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 19 },
  f1Text: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  f2: {
    borderWidth: 1,
    borderColor: '#DCDCDC',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 19,
  },
  f2Text: { fontSize: 11, fontWeight: '600', color: colors.ink },
  banWrap: { marginHorizontal: 16, marginTop: 8 },
  banner: { height: 110, borderRadius: radii.banner, overflow: 'hidden', backgroundColor: '#DDD' },
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
  k: { color: '#FFF', fontFamily: 'Georgia', fontSize: 16 },
  s: {
    color: '#FFF',
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    opacity: 0.9,
    marginTop: 4,
  },
  cell: { paddingHorizontal: layout.gutter / 2 },
});
