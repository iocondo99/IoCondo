import React from 'react';
import { Stack } from 'expo-router';
import { ToastProvider, keepSplashScreenVisible, useAppFonts } from '@iocondo/ui';
import { AuthProvider } from '@/context/AuthContext';

keepSplashScreenVisible();

export default function RootLayout() {
  const { ready } = useAppFonts();
  if (!ready) return null;

  return (
    <AuthProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(pubblico)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="design-system" />
        </Stack>
      </ToastProvider>
    </AuthProvider>
  );
}
