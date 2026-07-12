import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampaignBanner } from '../../components/CampaignBanner';
import { EmptyState } from '../../components/EmptyState';
import { PriceSheet, type PriceFilter } from '../../components/PriceSheet';
import { ProductPin } from '../../components/ProductPin';
import { useFeedProducts, useLiveCampaigns } from '../../lib/queries';
import { colors, layout, type } from '../../theme/tokens';
import type { FeedProduct } from '../../types/db';

const BRAND_CHIPS = [
  { slug: 'all', label: 'All brands' },
  { slug: 'nishat', label: 'Nishat Linen' },
  { slug: 'limelight', label: 'Limelight' },
  { slug: 'khaadi', label: 'Khaadi' },
];

/** Prototype `match()` semantics: search across title+brand (+fabric),
 * brand chip, price range on the first variant, sale-only on compare-at. */
function matches(
  p: FeedProduct,
  f: { q: string; brand: string; range: [number, number] | null; saleOnly: boolean },
): boolean {
  if (f.q) {
    const hay = `${p.title} ${p.brand.name} ${p.fabric ?? ''}`.toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  if (f.brand !== 'all' && p.brand.slug !== f.brand) return false;
  const v = p.variants[0];
  if (!v) return false;
  if (f.range && (v.price < f.range[0] || v.price > f.range[1])) return false;
  if (f.saleOnly && !(v.compare_at_price && v.compare_at_price > v.price)) return false;
  return true;
}

export default function HomeScreen() {
  const { data: products, isLoading, error, refetch } = useFeedProducts();
  const { data: campaigns } = useLiveCampaigns();

  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [filter, setFilter] = useState<PriceFilter>({ range: null, saleOnly: false });
  const [sheetOpen, setSheetOpen] = useState(false);

  const list = useMemo(
    () =>
      (products ?? []).filter((p) =>
        matches(p, { q: q.toLowerCase().trim(), brand, ...filter }),
      ),
    [products, q, brand, filter],
  );

  /** Live count for the sheet's Apply button (respects current brand + search). */
  const countFor = useCallback(
    (f: PriceFilter) =>
      (products ?? []).filter((p) =>
        matches(p, { q: q.toLowerCase().trim(), brand, ...f }),
      ).length,
    [products, q, brand],
  );

  const filterActive = !!(filter.range || filter.saleOnly);

  const header = (
    <View>
      <View style={styles.hh}>
        <Text style={[type.wordmark, { fontSize: 18 }]}>KAPRAY</Text>
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchIn}
          placeholder="🔍  Search brands, lawn, kurtas, silk…"
          placeholderTextColor="#9A9A9A"
          value={q}
          onChangeText={setQ}
          autoCorrect={false}
        />
      </View>
      <CampaignBanner campaigns={campaigns ?? []} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Pressable
          style={[styles.chip, filterActive && styles.chipOn]}
          onPress={() => setSheetOpen(true)}
        >
          <Text style={[styles.chipText, { fontWeight: '700' }, filterActive && styles.chipTextOn]}>
            Price <Text style={{ fontSize: 9, opacity: 0.65 }}>▾</Text>
          </Text>
        </Pressable>
        {BRAND_CHIPS.map((b) => (
          <Pressable
            key={b.slug}
            style={[styles.chip, brand === b.slug && styles.chipOn]}
            onPress={() => setBrand(b.slug)}
          >
            <Text style={[styles.chipText, brand === b.slug && styles.chipTextOn]}>{b.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.sect}>
        <Text style={type.sectionTitle}>
          Shop the look{'  '}
          <Text style={styles.sectSmall}>{list.length} live products</Text>
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <EmptyState
            title="Couldn't load the feed"
            body={`${(error as Error).message}\n\nPull to retry, or check your connection and Supabase env config.`}
          />
          <Pressable style={styles.retry} onPress={() => refetch()}>
            <Text style={type.ctaLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : (
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
              title="No results"
              body="Try widening your price range or clearing the search."
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          onRefresh={refetch}
          refreshing={false}
        />
      )}
      <PriceSheet
        visible={sheetOpen}
        initial={filter}
        countFor={countFor}
        onApply={(f) => {
          setFilter(f);
          setSheetOpen(false);
        }}
        onClear={() => {
          setFilter({ range: null, saleOnly: false });
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hh: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  searchWrap: { paddingHorizontal: layout.pageMargin, paddingTop: 6 },
  searchIn: {
    backgroundColor: colors.chip,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    color: colors.ink,
  },
  chipRow: { gap: 8, paddingHorizontal: layout.pageMargin, paddingTop: 10, paddingBottom: 6 },
  chip: {
    backgroundColor: colors.chip,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 19,
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: '500', color: colors.ink },
  chipTextOn: { color: '#FFF' },
  sect: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  sectSmall: { fontWeight: '400', color: colors.muted, fontSize: 11 },
  cell: { paddingHorizontal: layout.gutter / 2 },
  retry: {
    backgroundColor: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
});
