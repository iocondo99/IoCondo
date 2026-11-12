import { DettaglioRataScreen } from '@/screens/DettaglioRataScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DettaglioRataPage() {
  return (
    <GuardiaModulo modulo="abilita_pagamenti" titolo="Pagamenti non attivi">
      <DettaglioRataScreen />
    </GuardiaModulo>
  );
}
