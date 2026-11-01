import React from 'react';
import { Stack } from 'expo-router';
import { ToastProvider, keepSplashScreenVisible, useAppFonts } from '@iocondo/ui';
import { AuthProvider } from '@/context/AuthContext';
import { RoleProvider } from '@/context/RoleContext';

keepSplashScreenVisible();

export default function RootLayout() {
  const { ready } = useAppFonts();
  if (!ready) return null;

  return (
    <AuthProvider>
      <RoleProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(pubblico)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="design-system" />
          </Stack>
        </ToastProvider>
      </RoleProvider>
    </AuthProvider>
  );
}
