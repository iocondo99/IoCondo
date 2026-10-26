import React from 'react';
import { Stack } from 'expo-router';
import { RoleProvider } from '@/context/RoleContext';

export default function RootLayout() {
  return (
    <RoleProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '900', fontSize: 20 },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="report-issue"
          options={{ title: 'Segnala un Guasto', presentation: 'card' }}
        />
        <Stack.Screen
          name="parcels"
          options={{ title: 'Registro Pacchi Portineria', presentation: 'card' }}
        />
      </Stack>
    </RoleProvider>
  );
}
