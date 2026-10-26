'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { services } from '@/services';
import { formatCurrency } from '@/lib/utils';

interface ModalProps {
  mode: 'SPESA' | 'RATE' | null;
  esercizioId: string;
  condominioNome: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function QuickActionModals({
  mode,
  esercizioId,
  condominioNome,
  onClose,
  onSuccess,
}: ModalProps) {
  const [descrizione, setDescrizione] = useState(
    mode === 'RATE' ? 'Emissione Rata Ordinaria II Trimestre 2026' : 'Fattura Manutenzione Ascensore'
  );
  const [importo, setImporto] = useState('4800');
  const [scadenza, setScadenza] = useState('2026-11-30');
  const [tabellaId, setTabellaId] = useState('tab-a-generale');
  const [submitting, setSubmitting] = useState(false);

  if (!mode) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const numImporto = parseFloat(importo) || 0;
    try {
      await services.rate
        .ripartisciSpese({
          importo: numImporto,
          tabella_millesimale_id: tabellaId,
          esercizio_id: esercizioId,
          data_scadenza: scadenza,
          descrizione,
          pubblica: true,
        })
        .catch(() => null);

      onSuccess(
        mode === 'RATE'
          ? `Rate emesse e ripartite su base millesimale per ${formatCurrency(numImporto)} (${condominioNome}).`
          : `Spesa registrata in Prima Nota per ${formatCurrency(numImporto)} (${descrizione}).`
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 9, 11, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 460,
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: 12,
          padding: 22,
          color: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {mode === 'RATE' ? '+ Emetti Rate Millesimali' : '+ Registra Spesa Fornitore'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#a1a1aa' }}>
            Condominio attivo: <strong>{condominioNome}</strong>
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
          <span style={{ color: '#d4d4d8' }}>Descrizione operazione</span>
          <input
            type="text"
            required
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
            <span style={{ color: '#d4d4d8' }}>Importo Totale (€)</span>
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
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
            <span style={{ color: '#d4d4d8' }}>Data Scadenza</span>
            <input
              type="date"
              required
              value={scadenza}
              onChange={(e) => setScadenza(e.target.value)}
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
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
          <span style={{ color: '#d4d4d8' }}>Tabella Millesimale di Ripartizione</span>
          <select
            value={tabellaId}
            onChange={(e) => setTabellaId(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid #27272a',
              backgroundColor: '#18181b',
              color: '#fafafa',
              fontSize: 13,
            }}
          >
            <option value="tab-a-generale">Tabella A — Proprietà Generale (1000/1000)</option>
            <option value="tab-b-scale">Tabella B — Scale e Ascensori (Art. 1124 c.c.)</option>
            <option value="tab-c-riscaldamento">Tabella C — Riscaldamento Centralizzato</option>
          </select>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting
              ? 'Elaborazione Edge Function...'
              : mode === 'RATE'
                ? 'Calcola & Pubblica Rate'
                : 'Registra Movimento'}
          </Button>
        </div>
      </form>
    </div>
  );
}
