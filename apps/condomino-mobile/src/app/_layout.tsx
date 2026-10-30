import React from 'react';
import { Stack } from 'expo-router';
import { keepSplashScreenVisible, useAppFonts } from '@iocondo/ui';
import { RoleProvider } from '@/context/RoleContext';

keepSplashScreenVisible();

export default function RootLayout() {
  const { ready } = useAppFonts();
  if (!ready) return null;

  return (
    <RoleProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="report-issue" options={{ title: 'Segnala un guasto' }} />
        <Stack.Screen name="parcels" options={{ title: 'Registro pacchi' }} />
      </Stack>
    </RoleProvider>
  );
}
