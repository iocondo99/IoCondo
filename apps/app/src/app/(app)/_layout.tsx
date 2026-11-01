import React from 'react';
import { Redirect, Stack, usePathname, type Href } from 'expo-router';
import { SessionLoading } from '@/components/auth/SessionLoading';
import { useAuth } from '@/context/AuthContext';

/**
 * Guardia delle pagine protette. Finché la sessione non è letta mostra il caricamento (niente lampo
 * della pagina protetta); senza sessione porta a /login ricordando la pagina richiesta.
 */
export default function ProtectedLayout() {
  const { status } = useAuth();
  const pathname = usePathname();

  if (status === 'loading') return <SessionLoading />;
  if (status === 'unauthenticated') {
    const target = pathname && pathname !== '/' ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login';
    // Il caricamento resta visibile finché la nuova pagina non è pronta: niente schermo vuoto.
    return (
      <>
        <Redirect href={target as Href} />
        <SessionLoading />
      </>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="report-issue" options={{ title: 'Segnala un guasto' }} />
      <Stack.Screen name="parcels" options={{ title: 'Registro pacchi' }} />
    </Stack>
  );
}
