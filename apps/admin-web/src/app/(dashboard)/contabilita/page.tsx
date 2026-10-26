'use client';

import React from 'react';
import { useCondominio } from '@/context/CondominioContext';
import { Card } from '@/components/ui/card';
import { RateReconciliationTable } from '@/components/dashboard/RateReconciliationTable';

export default function ContabilitaRatePage() {
  const { activeCondominio, activeEsercizio } = useCondominio();

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Contabilità, Prima Nota & Riconciliazione — Esercizio {activeEsercizio.anno}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>
          {activeCondominio.nome} • IBAN Conto Condominiale: {activeCondominio.iban_principale ?? 'IT60X0542811101000000123456'}
        </p>
      </div>

      <Card>
        <RateReconciliationTable />
      </Card>
    </div>
  );
}
