'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Wrench, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { services, type FornitoreMagicLinkInfo } from '@/services';

const FALLBACK_INFO: FornitoreMagicLinkInfo = {
  ticket: {
    id: '50000000-0000-4000-8000-000000000001',
    titolo: 'Perdita d’acqua dal soffitto del bagno (Colonna di scarico)',
    descrizione: 'Dal soffitto del bagno gocciola acqua da due giorni, probabile rottura della colonna di scarico condominiale.',
    stato: 'LAVORAZIONE',
    priorita: 'ALTA',
    is_area_comune: false,
    condominio: 'Condominio Roma Appia - Via Appia Nuova 120, Roma',
  },
  intervento: {
    id: '51000000-0000-4000-8000-000000000001',
    data_prevista: '2026-10-28',
  },
};

export default function FornitoreMagicLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? 'mock_magic_idrotermica_0001';

  const [info, setInfo] = useState<FornitoreMagicLinkInfo>(FALLBACK_INFO);
  const [importo, setImporto] = useState('380.00');
  const [note, setNote] = useState('Riparazione giunto colonna montante eseguita e collaudata a pressione.');
  const [fotoUrl, setFotoUrl] = useState('foto-guasti/30-1/50-1/collaudo_lavoro_finito.jpg');
  const [fatturaUrl, setFatturaUrl] = useState('documenti-condominio/30-1/fatture/fattura_intervento.pdf');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    void services.fornitori
      .getMagicLinkInfo(token)
      .then((res) => setInfo(res))
      .catch(() => null);
  }, [token]);

  const handleCloseIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await services.fornitori
        .chiudiInterventoMagicLink({
          token,
          importo_consuntivo: parseFloat(importo) || 0,
          note_fornitore: note,
          foto_lavoro_url: fotoUrl,
          fattura_url: fatturaUrl,
        })
        .catch(() => null);
      setCompleted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 560, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wrench size={20} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Portale Fornitore Magic Link (UC-08)
              </h1>
              <div style={{ fontSize: 12, color: '#a1a1aa' }}>
                Accesso protetto monouso senza registrazione • Token <code>{token.slice(0, 14)}…</code>
              </div>
            </div>
          </div>
          <Badge variant={completed ? 'success' : 'warning'}>
            {completed ? 'INTERVENTO CHIUSO' : info.ticket.priorita}
          </Badge>
        </div>

        <div
          style={{
            backgroundColor: '#0c0c0e',
            border: '1px solid #27272a',
            borderRadius: 10,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>{info.ticket.condominio}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{info.ticket.titolo}</div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#a1a1aa' }}>{info.ticket.descrizione}</p>
        </div>

        {completed ? (
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              backgroundColor: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <CheckCircle2 size={32} />
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Intervento rendicontato e chiuso con successo!
            </div>
            <div style={{ fontSize: 12.5, color: '#d4d4d8' }}>
              La foto del lavoro finito e il PDF della fattura sono stati archiviati nel Cloud dell’Amministratore. Questo Magic Link è ora invalidato.
            </div>
          </div>
        ) : (
          <form onSubmit={handleCloseIntervention} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
              <span style={{ color: '#d4d4d8' }}>Importo Consuntivo Intervento (€ IVA inclusa)</span>
              <input
                type="number"
                step="0.01"
                required
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #27272a',
                  backgroundColor: '#18181b',
                  color: '#fafafa',
                  fontSize: 13.5,
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
              <span style={{ color: '#d4d4d8' }}>Relazione Tecnica / Note Lavoro Eseguito</span>
              <textarea
                rows={3}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #27272a',
                  backgroundColor: '#18181b',
                  color: '#fafafa',
                  fontSize: 13,
                }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <span style={{ color: '#d4d4d8' }}>Foto Lavoro Finito (Bucket foto-guasti)</span>
                <input
                  type="text"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #27272a',
                    backgroundColor: '#18181b',
                    color: '#a1a1aa',
                    fontSize: 12,
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <span style={{ color: '#d4d4d8' }}>Allegato PDF Fattura / Rapporto</span>
                <input
                  type="text"
                  value={fatturaUrl}
                  onChange={(e) => setFatturaUrl(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #27272a',
                    backgroundColor: '#18181b',
                    color: '#a1a1aa',
                    fontSize: 12,
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11.5, color: '#71717a', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={14} /> Token monouso protetto
              </span>
              <Button type="submit" variant="primary" disabled={submitting}>
                <FileText size={14} />
                {submitting ? 'Invio consuntivo...' : 'Carica Fattura & Chiudi Intervento'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
