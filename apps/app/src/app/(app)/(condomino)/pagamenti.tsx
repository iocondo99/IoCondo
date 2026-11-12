import { PagamentiScreen } from '@/screens/PagamentiScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function PagamentiPage() {
  return (
    <GuardiaModulo modulo="abilita_pagamenti" titolo="Pagamenti non attivi">
      <PagamentiScreen />
    </GuardiaModulo>
  );
}
