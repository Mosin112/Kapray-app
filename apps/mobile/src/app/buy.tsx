import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { clickoutUrl } from '../lib/format';
import { colors } from '../theme/tokens';

/**
 * WebView checkout (spec §8): full-screen brand site with UTM params.
 * Header = brand + lock + domain, always-available close (×). No URL bar editing.
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
  const [canGoBack, setCanGoBack] = useState(false);

  /** Always leaves the WebView, whatever the nav stack looks like. */
  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  useEffect(() => {
    if (!url) dismiss();
  }, [url, dismiss]);

  // Android hardware back: step through web history first, then dismiss.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webref.current) {
        webref.current.goBack();
        return true;
      }
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, dismiss]);

  if (!url) return null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable hitSlop={12} style={styles.close} onPress={dismiss} accessibilityLabel="Close">
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand} numberOfLines={1}>
            {brandName}
          </Text>
          <Text style={styles.domain} numberOfLines={1}>
            🔒 {domain}
          </Text>
        </View>
        <Pressable hitSlop={10} style={styles.done} onPress={dismiss}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
      <WebView
        ref={webref}
        source={{ uri: clickoutUrl(url) }}
        style={{ flex: 1 }}
        onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
        onShouldStartLoadWithRequest={(req) => {
          // Hand OS-native schemes to the system; keep web (incl. 3DS) inside.
          if (/^(tel:|mailto:|intent:|sms:|whatsapp:)/.test(req.url)) {
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  brand: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  domain: { fontSize: 10.5, color: colors.muted, marginTop: 1 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 18 },
  done: { paddingHorizontal: 6, paddingVertical: 4 },
  doneText: { fontSize: 13, fontWeight: '700', color: colors.ink },
});
