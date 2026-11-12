import React from 'react';
import { AssembleeScreen } from '@/screens/AssembleeScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function AssembleePage() {
  return (
    <GuardiaModulo modulo="abilita_assemblee" titolo="Assemblee non attive">
      <AssembleeScreen />
    </GuardiaModulo>
  );
}
