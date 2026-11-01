import React from 'react';
import { PasswordScreen } from '@/screens/PasswordScreen';

/** Primo accesso da invito: pagina aperta dal link dell'email (token_hash e type=invite). */
export default function ImpostaPasswordRoute() {
  return <PasswordScreen modo="invito" />;
}
