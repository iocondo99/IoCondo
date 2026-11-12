import React from 'react';
import { DettaglioAssembleaScreen } from '@/screens/DettaglioAssembleaScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DettaglioAssembleaPage() {
  return (
    <GuardiaModulo modulo="abilita_assemblee" titolo="Assemblee non attive">
      <DettaglioAssembleaScreen />
    </GuardiaModulo>
  );
}

