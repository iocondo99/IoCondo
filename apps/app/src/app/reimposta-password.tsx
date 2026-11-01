import React from 'react';
import { PasswordScreen } from '@/screens/PasswordScreen';

/** Reimpostazione ("Password dimenticata?"): pagina aperta dal link dell'email (token_hash e type=recovery). */
export default function ReimpostaPasswordRoute() {
  return <PasswordScreen modo="recupero" />;
}
