import React, { useEffect, useRef, useState } from 'react';
import { Redirect, Stack, useGlobalSearchParams, type Href } from 'expo-router';
import { homeDi, safeReturnPath, scegliCondominio, scegliVista } from '@iocondo/data';
import { platformStorage } from '@iocondo/supabase-client/storage';
import { SessionLoading } from '@/components/auth/SessionLoading';
import { useAuth } from '@/context/AuthContext';
import { services } from '@/services';

/**
 * Pagine aperte a tutti (Landing Page e Login).
 * Chi non è autenticato vede la Landing su "/" e il modulo su "/login".
 * Chi è già autenticato viene reindirizzato alla sua destinazione o alla Home del suo ruolo,
 * evitando di rivedere la presentazione o il modulo di accesso.
 */
export default function PublicLayout() {
  const { status, user } = useAuth();
  const { redirect } = useGlobalSearchParams<{ redirect?: string }>();
  // Il parametro sparisce dall'indirizzo mentre la navigazione parte: la destinazione si ricorda al primo sguardo.
  const returnTo = useRef<string | null>(null);
  if (redirect !== undefined && returnTo.current === null) {
    const safe = safeReturnPath(redirect);
    if (safe !== '/') {
      returnTo.current = safe;
    }
  }

  const [resolvedHome, setResolvedHome] = useState<string | null>(returnTo.current);

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    if (returnTo.current) {
      setResolvedHome(returnTo.current);
      return;
    }
    let active = true;
    Promise.all([
      services.profilo.carica(user.id, user.email),
      platformStorage.getItem('iocondo.preferenze.v1'),
    ])
      .then(([profilo, preferenzeStr]) => {
        if (!active) return;
        const preferenze = preferenzeStr ? JSON.parse(preferenzeStr) : {};
        const condominioId = scegliCondominio(profilo, preferenze.condominioId);
        const vista = scegliVista(profilo, condominioId, preferenze.vista);
        setResolvedHome(vista ? homeDi(vista) : '/home');
      })
      .catch(() => {
        if (active) setResolvedHome('/home');
      });
    return () => {
      active = false;
    };
  }, [status, user]);

  if (status === 'loading') return <SessionLoading />;
  if (status === 'authenticated') {
    if (resolvedHome) {
      return (
        <>
          <Redirect href={resolvedHome as Href} />
          <SessionLoading />
        </>
      );
    }
    return <SessionLoading />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
