import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { clickoutUrl } from '../lib/format';
import { colors } from '../theme/tokens';

/**
 * WebView checkout (spec §8): full-screen brand site with UTM params.
 * Header = brand + lock + domain, close button. No URL bar editing.
 * tel:/mailto:/intent: hand off to the OS; everything else (incl. payment
 * 3DS redirects) stays in the WebView. No script injection into checkout.
 *
 * Phase 4 adds: clickout/webview_opened analytics, purchase_detected
 * heuristic on /thank_you etc., and the "Order placed 🎉" toast.
 */
export default function BuyScreen() {
  const router = useRouter();
  const { url, brandName, domain } = useLocalSearchParams<{
    url: string;
    brandName: string;
    domain: string;
    productId?: string;
    brandId?: string;
  }>();
  const webref = useRef<WebView>(null);

  if (!url) {
    router.back();
    return null;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand} numberOfLines={1}>
            {brandName}
          </Text>
          <Text style={styles.domain} numberOfLines={1}>
            🔒 {domain}
          </Text>
        </View>
        <Pressable hitSlop={10} style={styles.close} onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>×</Text>
        </Pressable>
      </View>
      <WebView
        ref={webref}
        source={{ uri: clickoutUrl(url) }}
        style={{ flex: 1 }}
        onShouldStartLoadWithRequest={(req) => {
          // Hand OS-native schemes to the system; keep web (incl. 3DS) inside.
          if (/^(tel:|mailto:|intent:|sms:)/.test(req.url)) {
            Linking.openURL(req.url).catch(() => {});
            return false;
          }
          return true;
        }}
        startInLoadingState
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  brand: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  domain: { fontSize: 10.5, color: colors.muted, marginTop: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
