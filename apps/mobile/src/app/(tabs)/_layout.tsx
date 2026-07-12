import { Tabs } from 'expo-router';
import React from 'react';
import { Text, type ColorValue } from 'react-native';

import { colors } from '../../theme/tokens';

/** Tab glyphs from the prototype: ⌂ HOME · ◎ SALES · ♡ SAVED · ◍ YOU. */
function Glyph({ char, color }: { char: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color, lineHeight: 24 }}>{char}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.tabIdle,
        tabBarLabelStyle: { fontSize: 8, letterSpacing: 1.5, fontWeight: '600' },
        tabBarStyle: { borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'HOME', tabBarIcon: ({ color }) => <Glyph char="⌂" color={color} /> }}
      />
      <Tabs.Screen
        name="sales"
        options={{ title: 'SALES', tabBarIcon: ({ color }) => <Glyph char="◎" color={color} /> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: 'SAVED', tabBarIcon: ({ color }) => <Glyph char="♡" color={color} /> }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'YOU', tabBarIcon: ({ color }) => <Glyph char="◍" color={color} /> }}
      />
    </Tabs>
  );
}
