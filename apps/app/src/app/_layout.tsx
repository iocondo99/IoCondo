import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { ToastProvider, keepSplashScreenVisible, useAppFonts } from '@iocondo/ui';
import { AuthProvider } from '@/context/AuthContext';

keepSplashScreenVisible();

// Tooltip CSS per gli elementi con `data-tooltip` (es. i Badge solo-icona).
// RN Web non inoltra l'attributo `title` sulle View, quindi usiamo una regola CSS
// basata su `data-tooltip` che mostra una piccola etichetta al passaggio del mouse.
const CSS_TOOLTIP = `
[data-tooltip] { position: relative; }
[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: #1e293b;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.2;
  padding: 4px 8px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
`;

function TooltipStyle() {
  if (Platform.OS !== 'web') return null;
  // Iniettiamo la regola una sola volta nel documento.
  return React.createElement('style', { dangerouslySetInnerHTML: { __html: CSS_TOOLTIP } });
}

export default function RootLayout() {
  const { ready } = useAppFonts();
  if (!ready) return null;

  return (
    <AuthProvider>
      <ToastProvider>
        <TooltipStyle />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(pubblico)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="design-system" />
        </Stack>
      </ToastProvider>
    </AuthProvider>
  );
}
