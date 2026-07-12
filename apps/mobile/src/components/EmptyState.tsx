import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/tokens';

/** Centered empty state matching the prototype (.empty). */
export function EmptyState({
  glyph,
  title,
  body,
}: {
  glyph?: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.wrap}>
      {glyph ? <Text style={styles.big}>{glyph}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  big: { fontSize: 40, marginBottom: 14, color: colors.muted },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  body: { fontSize: 12, lineHeight: 19, color: colors.muted, textAlign: 'center' },
});
