import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, type } from '../theme/tokens';

export interface PriceFilter {
  range: [number, number] | null;
  saleOnly: boolean;
}

/** Quick ranges from the prototype: Under 2k / 2–5k / 5–9k / 9k+ (PKR). */
const RANGES: { label: string; range: [number, number] }[] = [
  { label: 'Under Rs 2,000', range: [0, 2000] },
  { label: 'Rs 2–5k', range: [2000, 5000] },
  { label: 'Rs 5–9k', range: [5000, 9000] },
  { label: 'Rs 9k+', range: [9000, 999999] },
];

/**
 * Price filter bottom sheet (spec §7.2): quick ranges, "On sale only" toggle,
 * live result count on the Apply button.
 */
export function PriceSheet({
  visible,
  initial,
  countFor,
  onApply,
  onClear,
  onClose,
}: {
  visible: boolean;
  initial: PriceFilter;
  /** Computes the would-be result count for a pending filter (live Apply label). */
  countFor: (f: PriceFilter) => number;
  onApply: (f: PriceFilter) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<PriceFilter>(initial);
  // Re-seed pending state each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPending(initial);
  }

  const n = countFor(pending);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.h3}>Filter by price</Text>

        <Text style={[type.groupLabel, styles.grp]}>Quick ranges</Text>
        <View style={styles.pills}>
          {RANGES.map((r) => {
            const on = pending.range?.[0] === r.range[0] && pending.range?.[1] === r.range[1];
            return (
              <Pressable
                key={r.label}
                style={[styles.pill, on && styles.pillOn]}
                onPress={() =>
                  setPending((p) => ({ ...p, range: on ? null : r.range }))
                }
              >
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[type.groupLabel, styles.grp]}>Deals</Text>
        <View style={styles.pills}>
          <Pressable
            style={[styles.pill, pending.saleOnly && styles.pillOn]}
            onPress={() => setPending((p) => ({ ...p, saleOnly: !p.saleOnly }))}
          >
            <Text style={[styles.pillText, pending.saleOnly && styles.pillTextOn]}>
              On sale only
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.apply} onPress={() => onApply(pending)}>
          <Text style={type.ctaLabel}>Show {n} results</Text>
        </Pressable>
        <Pressable onPress={onClear}>
          <Text style={styles.clr}>Clear all</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 34,
  },
  grab: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#DCDCDC',
    alignSelf: 'center',
    marginBottom: 14,
  },
  h3: { fontSize: 15.5, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  grp: { marginTop: 16, marginBottom: 9 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1,
    borderColor: '#DCDCDC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.chip,
  },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 12, color: colors.ink },
  pillTextOn: { color: '#FFF' },
  apply: {
    backgroundColor: colors.ink,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  clr: {
    textAlign: 'center',
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 12,
    textDecorationLine: 'underline',
  },
});
