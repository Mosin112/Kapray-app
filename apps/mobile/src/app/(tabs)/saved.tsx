import { FlashList } from '@shopify/flash-list';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../../components/EmptyState';
import { ProductPin } from '../../components/ProductPin';
import { useFeedProducts } from '../../lib/queries';
import { useWishlist } from '../../lib/wishlist';
import { colors, layout, type } from '../../theme/tokens';

/** Saved (wishlist) — spec §7.6. Local ids for now; migrates to
 * `wishlist_items` on sign-in in Phase 3. */
export default function SavedScreen() {
  const { data: products } = useFeedProducts();
  const wishlist = useWishlist();

  const list = useMemo(
    () => (products ?? []).filter((p) => wishlist.has(p.id)),
    [products, wishlist.ids],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={[type.wordmark, styles.title]}>SAVED</Text>
      {list.length > 0 ? (
        <>
          <Text style={styles.subtitle}>We’ll alert you on price drops & restocks</Text>
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
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
          />
        </>
      ) : (
        <EmptyState
          glyph="♡"
          title="Nothing saved yet"
          body="Tap the heart on any product — we'll watch its price and stock for you across every brand."
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 15, textAlign: 'center', paddingTop: 12, paddingBottom: 6 },
  subtitle: { fontSize: 11, color: colors.muted, textAlign: 'center', marginBottom: 8 },
  cell: { paddingHorizontal: layout.gutter / 2 },
});
