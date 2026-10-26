import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';

function TabEmoji({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 24 }}>{emoji}</Text>;
}

/**
 * Layout a Tab inferiori ad alto contrasto WCAG AAA (Senior-Friendly):
 * - Home
 * - Spese/Ricevute
 * - Avvisi
 * - Profilo/Aiuto
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0F172A',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontSize: 22,
          fontWeight: '900',
        },
        tabBarStyle: {
          height: 78,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: '#0F172A',
          borderTopWidth: 3,
          borderTopColor: '#334155',
        },
        tabBarActiveTintColor: '#FACC15',
        tabBarInactiveTintColor: '#E2E8F0',
        tabBarLabelStyle: {
          fontSize: 15,
          fontWeight: '800',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'IoCondo • Casa Tua',
          tabBarIcon: () => <TabEmoji emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="spese"
        options={{
          title: 'Spese/Ricevute',
          headerTitle: 'Spese & Ricevute',
          tabBarIcon: () => <TabEmoji emoji="🧾" />,
        }}
      />
      <Tabs.Screen
        name="avvisi"
        options={{
          title: 'Avvisi',
          headerTitle: 'Bacheca & Avvisi',
          tabBarIcon: () => <TabEmoji emoji="📢" />,
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: 'Profilo/Aiuto',
          headerTitle: 'Profilo & Aiuto Rapido',
          tabBarIcon: () => <TabEmoji emoji="☎️" />,
        }}
      />
    </Tabs>
  );
}
