import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../../components/BrandLogo';
import { cdnImage, fmtPrice, offPct, syncedAgo } from '../../lib/format';
import { useFeedProducts, useProduct } from '../../lib/queries';
import { useWishlist } from '../../lib/wishlist';
import { colors, radii, type } from '../../theme/tokens';

const W = Dimensions.get('window').width;

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const wishlist = useWishlist();
  const { data: p, isLoading } = useProduct(id);
  const { data: all } = useFeedProducts();
  const [heroIdx, setHeroIdx] = useState(0);

  if (isLoading || !p) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.ink} />
      </SafeAreaView>
    );
  }

  const v = p.variants[0];
  const off = v ? offPct(v.price, v.compare_at_price) : null;
  const onSale = off != null; // compare-at strictly above price
  const inStock = v?.available ?? false;
  const saved = wishlist.has(p.id);
  const currency = p.brand.currency;
  // "More like this": cross-brand rail (spec §7.3) — everything else for MVP.
  const sims = (all ?? []).filter((x) => x.id !== p.id).slice(0, 8);
  const heroW = W - 32;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView>
        {/* Hero: swipeable gallery (paged horizontal scroll, like a brand PDP) */}
        <View style={styles.heroWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              setHeroIdx(Math.round(e.nativeEvent.contentOffset.x / heroW))
            }
          >
            {(p.images.length ? p.images : [null]).map((img, i) => (
              <View key={i} style={[styles.hero, { width: heroW }]}>
                {img ? (
                  <Image
                    source={{ uri: cdnImage(img.src, 1080) }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    contentPosition="top"
                    transition={150}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.noImg]}>
                    <Text style={styles.noImgText}>{p.brand.name.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          {p.images.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {p.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === heroIdx && styles.dotOn]} />
              ))}
            </View>
          ) : null}
          <Pressable style={[styles.rbtn, { top: 12, left: 28 }]} onPress={() => router.back()}>
            <Text style={{ fontSize: 15 }}>←</Text>
          </Pressable>
        </View>

        {/* Brand row */}
        <View style={styles.meta}>
          <Pressable style={styles.brandRow} onPress={() => router.push(`/brand/${p.brand.slug}`)}>
            <BrandLogo brand={p.brand} width={52} height={34} />
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName}>{p.brand.name}</Text>
              <Text style={styles.brandDomain}>{p.brand.domain}</Text>
            </View>
            <View style={styles.visit}>
              <Text style={styles.visitText}>Visit store ↗</Text>
            </View>
          </Pressable>

          <Text style={styles.title}>{p.title}</Text>
          <Text style={styles.price}>
            {v ? fmtPrice(currency, v.price) : ''}
            {onSale ? (
              <>
                <Text style={styles.compareAt}>  {fmtPrice(currency, v!.compare_at_price!)}</Text>
                <Text style={styles.offPct}>  -{off}%</Text>
              </>
            ) : (
              <Text style={[styles.offPct, { color: colors.green }]}>  NEW IN</Text>
            )}
          </Text>
          <Text style={styles.fresh}>
            <Text style={{ color: inStock ? colors.green : colors.red, fontWeight: '600' }}>
              ● {inStock ? 'In stock' : 'Sold out'}
            </Text>
            <Text> on brand site · {syncedAgo(p.last_seen_at)}</Text>
          </Text>
          {currency === 'USD' ? (
            <Text style={styles.usdNote}>Sold via Khaadi’s international store</Text>
          ) : null}
        </View>

        {/* More like this */}
        {sims.length > 0 ? (
          <>
            <Text style={[type.sectionTitle, styles.simTitle]}>More like this</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.simRow}
            >
              {sims.map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.sim}
                  onPress={() => router.replace(`/product/${s.id}`)}
                >
                  {s.images[0] ? (
                    <Image
                      source={{ uri: cdnImage(s.images[0].src, 540) }}
                      style={styles.simImg}
                      contentFit="cover"
                      contentPosition="top"
                    />
                  ) : (
                    <View style={[styles.simImg, styles.noImg]} />
                  )}
                  <Text style={styles.simCap} numberOfLines={1}>
                    {s.brand.name} · {s.variants[0] ? fmtPrice(s.brand.currency, s.variants[0].price) : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* Sticky CTA (spec §7.3, §11.7) */}
      <View style={styles.ctaBar}>
        <Pressable
          style={[styles.sq, saved && { borderColor: colors.red }]}
          onPress={() => wishlist.toggle(p.id)}
        >
          <Text style={{ fontSize: 18, color: saved ? colors.red : colors.ink }}>
            {saved ? '♥' : '♡'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.ctaMain}
          onPress={() =>
            router.push({
              pathname: '/buy',
              params: {
                url: p.product_url,
                brandName: p.brand.name,
                domain: p.brand.domain,
                productId: p.id,
                brandId: p.brand.id,
              },
            })
          }
        >
          <Text style={type.ctaLabel}>Buy on {p.brand.name} ↗</Text>
          <Text style={styles.ctaSub}>Checkout, delivery & returns handled by the brand</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  heroWrap: { marginHorizontal: 16, marginTop: 4 },
  hero: {
    height: 400,
    borderRadius: radii.pdpHero,
    overflow: 'hidden',
    backgroundColor: colors.placeholder,
  },
  noImg: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE8DA' },
  noImgText: { fontFamily: 'Georgia', fontSize: 18, color: '#A3947C', letterSpacing: 2 },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { backgroundColor: '#FFF', width: 16 },
  rbtn: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  meta: { paddingHorizontal: 22, paddingTop: 15 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  brandDomain: { fontSize: 10.5, color: colors.muted },
  visit: {
    borderWidth: 1,
    borderColor: '#DCDCDC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 17,
  },
  visitText: { fontSize: 10.5, fontWeight: '600', color: colors.ink },
  title: { fontSize: 16.5, fontWeight: '700', marginTop: 13, lineHeight: 21, color: colors.ink },
  price: { fontSize: 18, fontWeight: '800', marginTop: 6, color: colors.ink },
  compareAt: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '400',
    textDecorationLine: 'line-through',
  },
  offPct: { color: colors.red, fontSize: 11.5, fontWeight: '700' },
  fresh: { fontSize: 10.5, color: colors.muted, marginTop: 5 },
  usdNote: { fontSize: 10, color: colors.muted, marginTop: 3, fontStyle: 'italic' },
  simTitle: { fontSize: 13.5, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 8 },
  simRow: { gap: 10, paddingHorizontal: 22, paddingBottom: 20 },
  sim: { width: 86 },
  simImg: { width: 86, height: 108, borderRadius: 12, backgroundColor: colors.placeholder },
  simCap: { fontSize: 9, color: colors.muted, marginTop: 4 },
  ctaBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  sq: {
    width: 50,
    borderWidth: 1,
    borderColor: '#DCDCDC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaMain: { flex: 1, backgroundColor: colors.ink, paddingVertical: 13, alignItems: 'center' },
  ctaSub: { fontSize: 8.5, letterSpacing: 0.8, color: '#BDBDBD', marginTop: 3 },
});
