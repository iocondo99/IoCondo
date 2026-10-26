'use client';

import React from 'react';
import { useCondominio } from '@/context/CondominioContext';
import { Card } from '@/components/ui/card';
import { TicketKanbanBoard } from '@/components/dashboard/TicketKanbanBoard';

export default function TicketGuastiPage() {
  const { activeCondominio } = useCondominio();

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Ticket, Manutenzioni & Portale Fornitori — {activeCondominio.nome}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>
          Gestione segnalazioni residenti e invio Magic Link senza registrazione per ditte esterne (UC-08).
        </p>
      </div>

      <Card>
        <TicketKanbanBoard />
      </Card>
    </div>
  );
}
