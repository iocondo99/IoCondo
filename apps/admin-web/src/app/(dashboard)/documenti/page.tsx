'use client';

import React from 'react';
import { FolderLock, FileText, ShieldCheck } from 'lucide-react';
import { useCondominio } from '@/context/CondominioContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DocumentiRlsPage() {
  const { activeCondominio } = useCondominio();

  const buckets = [
    { bucket: 'ricevute-rate', visibilita: 'Privato (RLS Unità / Utente)', descrizione: 'Quietanze di pagamento rate e bollettini PDF.' },
    { bucket: 'foto-guasti', visibilita: 'Lettura Condòmini & Magic Link Fornitore', descrizione: 'Foto allegate dai residenti e consuntivi lavori.' },
    { bucket: 'documenti-condominio', visibilita: 'Privato Tenant Condominio', descrizione: 'Verbali assemblee, regolamento condominiale, polizza globale fabbricati.' },
    { bucket: 'avatar-utenti', visibilita: 'Pubblico CDN', descrizione: 'Immagini profilo amministratori e residenti.' },
  ];

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Documenti & Supabase Storage RLS — {activeCondominio.nome}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>
          Archivio documentale protetto da policy Row-Level Security su `storage.objects`.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {buckets.map((b) => (
          <Card key={b.bucket} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FolderLock size={15} /> {b.bucket}
              </span>
              <Badge variant="success"><ShieldCheck size={11} /> RLS Attiva</Badge>
            </div>
            <div style={{ fontSize: 12, color: '#34d399' }}>{b.visibilita}</div>
            <p style={{ margin: 0, fontSize: 12.5, color: '#a1a1aa' }}>{b.descrizione}</p>
            <div style={{ fontSize: 11.5, color: '#71717a', display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileText size={12} /> Path prefix: <code>{activeCondominio.id}/...</code>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
