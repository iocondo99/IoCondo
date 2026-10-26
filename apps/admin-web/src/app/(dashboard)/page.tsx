'use client';

import React, { useState } from 'react';
import {
  ChevronRight,
  Plus,
  Wallet,
  AlertTriangle,
  Wrench,
  Users,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useCondominio } from '@/context/CondominioContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RateReconciliationTable } from '@/components/dashboard/RateReconciliationTable';
import { TicketKanbanBoard } from '@/components/dashboard/TicketKanbanBoard';
import { QuickActionModals } from '@/components/dashboard/QuickActionModals';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { activeCondominio, activeEsercizio, loading, error } = useCondominio();
  const [modalMode, setModalMode] = useState<'SPESA' | 'RATE' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [incassato, setIncassato] = useState<number>(148920.0);
  const [insoluto, setInsoluto] = useState<number>(8430.5);

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* TOP BAR: Breadcrumbs, Esercizio Contabile Attivo & Pulsanti Azione Rapida */}
      <header
        style={{
          padding: '16px 28px',
          borderBottom: '1px solid #27272a',
          backgroundColor: 'rgba(9, 9, 11, 0.85)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <nav
            aria-label="Breadcrumb"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a1a1aa' }}
          >
            <span>Studio Rossi</span>
            <ChevronRight size={14} />
            <span style={{ color: '#fafafa', fontWeight: 600 }}>{activeCondominio.nome}</span>
            <ChevronRight size={14} />
            <span>Panoramica</span>
          </nav>

          <Badge variant="success" style={{ marginLeft: 6 }}>
            Esercizio {activeEsercizio.anno} • {activeEsercizio.stato}
          </Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button variant="secondary" size="md" onClick={() => setModalMode('SPESA')}>
            <Plus size={15} />
            Registra Spesa
          </Button>
          <Button variant="primary" size="md" onClick={() => setModalMode('RATE')}>
            <Plus size={15} />
            Emetti Rate
          </Button>
        </div>
      </header>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Notifica Operazione Rapida */}
        {toastMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              backgroundColor: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>✓ {toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#34d399',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Chiudi
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: 13,
            }}
          >
            Errore caricamento dati: {error}
          </div>
        )}

        {/* RIGA 4 KPI NUMERICI AD ALTO IMPATTO VISIVO */}
        <section
          aria-label="Indicatori chiave di performance"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
            gap: 16,
          }}
        >
          {loading ? (
            <>
              <Skeleton style={{ height: 126 }} />
              <Skeleton style={{ height: 126 }} />
              <Skeleton style={{ height: 126 }} />
              <Skeleton style={{ height: 126 }} />
            </>
          ) : (
            <>
              {/* KPI 1: Totale Incassato */}
              <Card style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa' }}>
                    TOTALE INCASSATO (ES. {activeEsercizio.anno})
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: 'rgba(16, 185, 129, 0.14)',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Wallet size={16} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#fafafa',
                    marginTop: 10,
                    letterSpacing: '-0.02em',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatCurrency(incassato)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 8,
                    fontSize: 12,
                    color: '#34d399',
                  }}
                >
                  <ArrowUpRight size={14} />
                  <span>94,6% del preventivo ordinario</span>
                </div>
              </Card>

              {/* KPI 2: Insoluto / Scoperto */}
              <Card style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa' }}>
                    INSOLUTO / SCOPERTO MOROSI
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: 'rgba(239, 68, 68, 0.14)',
                      color: '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AlertTriangle size={16} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#f87171',
                    marginTop: 10,
                    letterSpacing: '-0.02em',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatCurrency(insoluto)}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#a1a1aa' }}>
                  2 posizioni oltre 30gg • <strong style={{ color: '#fbbf24' }}>Sollecito PEC pronto</strong>
                </div>
              </Card>

              {/* KPI 3: Ticket Aperti / Urgenti */}
              <Card style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa' }}>
                    TICKET APERTI / URGENTI
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: 'rgba(245, 158, 11, 0.14)',
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Wrench size={16} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#fafafa',
                    marginTop: 10,
                    letterSpacing: '-0.02em',
                  }}
                >
                  3 Aperti <span style={{ fontSize: 15, color: '#f87171', fontWeight: 600 }}>(1 Urgente)</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#a1a1aa' }}>
                  2 fornitori con Magic Link attivo
                </div>
              </Card>

              {/* KPI 4: Quorum Assemblea */}
              <Card style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa' }}>
                    QUORUM PROSSIMA ASSEMBLEA
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: 'rgba(59, 130, 246, 0.14)',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={16} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#fafafa',
                    marginTop: 10,
                    letterSpacing: '-0.02em',
                    fontFamily: 'monospace',
                  }}
                >
                  684,50 <span style={{ fontSize: 15, color: '#a1a1aa' }}>/ 1000 mm</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={14} />
                  <span>2ª Convocazione Valida (28/36 teste)</span>
                </div>
              </Card>
            </>
          )}
        </section>

        {/* SEZIONE TABELLA INTERATTIVA MONITORAGGIO RATE & RICONCILIAZIONE */}
        <Card>
          <RateReconciliationTable
            loading={loading}
            onStatusChange={(updatedRows) => {
              const totPagato = updatedRows
                .filter((r) => r.stato === 'RICONCILIATO')
                .reduce((acc, r) => acc + r.importoDovuto, 147905);
              const totScaduto = updatedRows
                .filter((r) => r.stato !== 'RICONCILIATO')
                .reduce((acc, r) => acc + r.importoDovuto, 5270);
              setIncassato(totPagato);
              setInsoluto(totScaduto);
            }}
          />
        </Card>

        {/* SEZIONE KANBAN GESTIONE GUASTI CON STATO FORNITORI */}
        <Card>
          <TicketKanbanBoard loading={loading} />
        </Card>
      </div>

      {/* Modali Azioni Rapide (+ Registra Spesa, + Emetti Rate) */}
      <QuickActionModals
        mode={modalMode}
        esercizioId={activeEsercizio.id}
        condominioNome={activeCondominio.nome}
        onClose={() => setModalMode(null)}
        onSuccess={(msg) => setToastMessage(msg)}
      />
    </main>
  );
}
