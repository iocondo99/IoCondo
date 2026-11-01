import React, { useRef } from 'react';
import { Redirect, Stack, useGlobalSearchParams, type Href } from 'expo-router';
import { safeReturnPath } from '@iocondo/data';
import { SessionLoading } from '@/components/auth/SessionLoading';
import { useAuth } from '@/context/AuthContext';

/** Pagine aperte a tutti. Chi è già dentro va alla pagina richiesta (o a "/"), senza vedere il modulo. */
export default function PublicLayout() {
  const { status } = useAuth();
  const { redirect } = useGlobalSearchParams<{ redirect?: string }>();
  // Il parametro sparisce dall'indirizzo mentre la navigazione parte: la destinazione si ricorda al primo sguardo.
  const returnTo = useRef('/');
  if (redirect !== undefined) returnTo.current = safeReturnPath(redirect);

  if (status === 'loading') return <SessionLoading />;
  if (status === 'authenticated') {
    return (
      <>
        <Redirect href={returnTo.current as Href} />
        <SessionLoading />
      </>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
