import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../../components/EmptyState';
import { colors, type } from '../../theme/tokens';

/** Profile — arrives with phone-OTP auth, follows and the Alerts inbox in
 * Phase 3 (spec §10). The prototype shows this as "coming in beta". */
export default function YouScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={[type.wordmark, styles.title]}>YOU</Text>
      <EmptyState
        glyph="◍"
        title="Profile — coming in beta"
        body="Sign in with your phone number to follow brands, sync your wishlist across devices, and manage drop alerts."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 15, textAlign: 'center', paddingTop: 12, paddingBottom: 6 },
});
