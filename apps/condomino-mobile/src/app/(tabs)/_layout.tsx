import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="spese" options={{ title: 'Spese' }} />
      <Tabs.Screen name="avvisi" options={{ title: 'Avvisi' }} />
      <Tabs.Screen name="profilo" options={{ title: 'Profilo' }} />
    </Tabs>
  );
}
