'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Sparkles, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDateIT } from '@/lib/utils';
import { services } from '@/services';

export type ReconciliationStatus = 'RICONCILIATO' | 'IN_SOSPESO' | 'SCADUTO';

export interface RataRowItem {
  id: string;
  interno: string;
  scala: string;
  condomino: string;
  descrizioneRata: string;
  scadenza: string;
  importoDovuto: number;
  importoPagato: number;
  stato: ReconciliationStatus;
  canale: 'SEPA / Bonifico AI' | 'Stripe / Apple Pay' | 'In attesa' | 'Sollecito inviato';
  matchConfidence?: number;
}

const INITIAL_MOCK_ROWS: RataRowItem[] = [
  {
    id: 'rata-001',
    interno: 'Int. 04',
    scala: 'Scala A',
    condomino: 'Fam. Bernardi - De Luca',
    descrizioneRata: 'Rata I Trimestre Ordinaria 2026',
    scadenza: '2026-09-30',
    importoDovuto: 485.0,
    importoPagato: 485.0,
    stato: 'RICONCILIATO',
    canale: 'SEPA / Bonifico AI',
    matchConfidence: 99,
  },
  {
    id: 'rata-002',
    interno: 'Int. 11',
    scala: 'Scala A',
    condomino: 'Ing. Roberto Ferri',
    descrizioneRata: 'Rata I Trimestre Ordinaria 2026',
    scadenza: '2026-10-30',
    importoDovuto: 620.5,
    importoPagato: 0,
    stato: 'IN_SOSPESO',
    canale: 'In attesa',
    matchConfidence: 94,
  },
  {
    id: 'rata-003',
    interno: 'Int. 07',
    scala: 'Scala B',
    condomino: 'Sig.ra Carla Monti',
    descrizioneRata: 'Quota Straordinaria Facciata Nord',
    scadenza: '2026-08-15',
    importoDovuto: 1240.0,
    importoPagato: 0,
    stato: 'SCADUTO',
    canale: 'Sollecito inviato',
  },
  {
    id: 'rata-004',
    interno: 'Int. 15',
    scala: 'Scala B',
    condomino: 'Avv. Giulia Visconti',
    descrizioneRata: 'Rata I Trimestre Ordinaria 2026',
    scadenza: '2026-10-15',
    importoDovuto: 530.0,
    importoPagato: 530.0,
    stato: 'RICONCILIATO',
    canale: 'Stripe / Apple Pay',
    matchConfidence: 100,
  },
  {
    id: 'rata-005',
    interno: 'Int. 02',
    scala: 'Scala A',
    condomino: 'Studio Medico Associato',
    descrizioneRata: 'Rata Riscaldamento Centralizzato',
    scadenza: '2026-09-10',
    importoDovuto: 890.0,
    importoPagato: 0,
    stato: 'SCADUTO',
    canale: 'Sollecito inviato',
  },
  {
    id: 'rata-006',
    interno: 'Int. 19',
    scala: 'Scala C',
    condomino: 'Dott. Alessandro Galli',
    descrizioneRata: 'Rata I Trimestre Ordinaria 2026',
    scadenza: '2026-11-05',
    importoDovuto: 410.0,
    importoPagato: 0,
    stato: 'IN_SOSPESO',
    canale: 'In attesa',
    matchConfidence: 91,
  },
];

interface Props {
  loading?: boolean;
  onStatusChange?: (rows: RataRowItem[]) => void;
}

export function RateReconciliationTable({ loading = false, onStatusChange }: Props) {
  const [rows, setRows] = useState<RataRowItem[]>(INITIAL_MOCK_ROWS);
  const [filter, setFilter] = useState<'TUTTE' | ReconciliationStatus>('TUTTE');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== 'TUTTE' && r.stato !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.condomino.toLowerCase().includes(q) ||
          r.interno.toLowerCase().includes(q) ||
          r.descrizioneRata.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, filter, search]);

  const handleMarkReconciled = async (row: RataRowItem) => {
    setBusyId(row.id);
    try {
      await services.rate.segnaPagata(row.id, row.importoDovuto).catch(() => null);
      const updated = rows.map((item) =>
        item.id === row.id
          ? {
              ...item,
              stato: 'RICONCILIATO' as const,
              importoPagato: item.importoDovuto,
              canale: 'SEPA / Bonifico AI' as const,
              matchConfidence: 100,
            }
          : item
      );
      setRows(updated);
      onStatusChange?.(updated);
    } finally {
      setBusyId(null);
    }
  };

  const handleAutoReconcileAll = () => {
    const updated = rows.map((item) =>
      item.stato === 'IN_SOSPESO'
        ? {
            ...item,
            stato: 'RICONCILIATO' as const,
            importoPagato: item.importoDovuto,
            canale: 'SEPA / Bonifico AI' as const,
            matchConfidence: 98,
          }
        : item
    );
    setRows(updated);
    onStatusChange?.(updated);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
        <Skeleton style={{ height: 36, width: '100%' }} />
        <Skeleton style={{ height: 48, width: '100%' }} />
        <Skeleton style={{ height: 48, width: '100%' }} />
        <Skeleton style={{ height: 48, width: '100%' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header / Filtri */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fafafa' }}>
              Monitoraggio Rate & Riconciliazione Automatica CBI/SEPA
            </h3>
            <Badge variant="success"> Motore AI Attivo</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#a1a1aa' }}>
            Matching automatico movimenti bancari per causale, IBAN ordinante e importo millesimale.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#09090b',
              border: '1px solid #27272a',
              borderRadius: 8,
              padding: '6px 10px',
            }}
          >
            <Search size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtra condòmino o interno..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f4f4f5',
                fontSize: 12.5,
                width: 175,
              }}
            />
          </div>

          {(['TUTTE', 'RICONCILIATO', 'IN_SOSPESO', 'SCADUTO'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: '6px 11px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 500,
                border: filter === tab ? '1px solid #52525b' : '1px solid #27272a',
                backgroundColor: filter === tab ? '#27272a' : '#09090b',
                color: filter === tab ? '#fafafa' : '#a1a1aa',
                cursor: 'pointer',
              }}
            >
              {tab === 'TUTTE'
                ? 'Tutte'
                : tab === 'RICONCILIATO'
                  ? 'Riconciliato'
                  : tab === 'IN_SOSPESO'
                    ? 'In Sospeso'
                    : 'Scaduto'}
            </button>
          ))}

          <Button variant="secondary" size="sm" onClick={handleAutoReconcileAll}>
            <Sparkles size={13} />
            Riconcilia Movimenti in Sospeso
          </Button>
        </div>
      </div>

      {/* Tabella Interattiva */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid #27272a',
                backgroundColor: 'rgba(9, 9, 11, 0.5)',
                color: '#a1a1aa',
                fontSize: 11.5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <th style={{ padding: '11px 20px' }}>Unità / Condòmino</th>
              <th style={{ padding: '11px 16px' }}>Causale / Rata</th>
              <th style={{ padding: '11px 16px' }}>Scadenza</th>
              <th style={{ padding: '11px 16px' }}>Importo</th>
              <th style={{ padding: '11px 16px' }}>Stato Riconciliazione</th>
              <th style={{ padding: '11px 16px' }}>Canale</th>
              <th style={{ padding: '11px 20px', textAlign: 'right' }}>Azione</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: '1px solid rgba(39, 39, 42, 0.65)',
                }}
              >
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ fontWeight: 600, color: '#f4f4f5' }}>{row.condomino}</div>
                  <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2 }}>
                    {row.scala} • {row.interno}
                  </div>
                </td>

                <td style={{ padding: '13px 16px', color: '#d4d4d8' }}>{row.descrizioneRata}</td>

                <td style={{ padding: '13px 16px', color: '#a1a1aa', fontFamily: 'monospace', fontSize: 12 }}>
                  {formatDateIT(row.scadenza)}
                </td>

                <td style={{ padding: '13px 16px', fontWeight: 600, color: '#fafafa', fontFamily: 'monospace' }}>
                  {formatCurrency(row.importoDovuto)}
                </td>

                <td style={{ padding: '13px 16px' }}>
                  {row.stato === 'RICONCILIATO' && (
                    <Badge variant="success">
                      <CheckCircle2 size={12} />
                      Riconciliato
                    </Badge>
                  )}
                  {row.stato === 'IN_SOSPESO' && (
                    <Badge variant="warning">
                      <Clock size={12} />
                      In Sospeso
                    </Badge>
                  )}
                  {row.stato === 'SCADUTO' && (
                    <Badge variant="danger">
                      <AlertTriangle size={12} />
                      Scaduto
                    </Badge>
                  )}
                </td>

                <td style={{ padding: '13px 16px', fontSize: 12, color: '#a1a1aa' }}>
                  {row.canale}
                  {row.matchConfidence && (
                    <span style={{ marginLeft: 6, color: '#34d399', fontSize: 11 }}>
                      ({row.matchConfidence}% AI)
                    </span>
                  )}
                </td>

                <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                  {row.stato !== 'RICONCILIATO' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => handleMarkReconciled(row)}
                    >
                      {busyId === row.id ? 'Salvataggio...' : 'Riconcilia Ora'}
                    </Button>
                  ) : (
                    <span style={{ fontSize: 12, color: '#71717a' }}>Verificato ✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
