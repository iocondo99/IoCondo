'use client';

import React from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { useCondominio } from '@/context/CondominioContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AssembleePage() {
  const { activeCondominio } = useCondominio();

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Assemblee Ibride & Calcolo Quorum — {activeCondominio.nome}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>
          Verifica teste e millesimi in tempo reale con privacy voto per i condòmini (UC-10).
        </p>
      </div>

      <Card style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={18} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              Assemblea Ordinaria Approvazione Bilancio Consuntivo
            </h3>
          </div>
          <Badge variant="success">
            <ShieldCheck size={12} /> Quorum Raggiunto: 684,50 / 1000 mm
          </Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#a1a1aa' }}>
          Modalità Ibrida (Presenza + Videoconferenza Meet) • 28 Condòmini presenti o per delega su 36 totali.
        </p>
      </Card>
    </div>
  );
}
