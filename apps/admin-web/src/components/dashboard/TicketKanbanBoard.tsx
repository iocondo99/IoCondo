'use client';

import React, { useState } from 'react';
import { Wrench, ExternalLink, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { services } from '@/services';

export type TicketColumnStatus = 'APERTO' | 'LAVORAZIONE' | 'RISOLTO';

export interface KanbanTicketItem {
  id: string;
  codice: string;
  titolo: string;
  categoria: string;
  unita: string;
  priorita: 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  stato: TicketColumnStatus;
  fornitoreNome: string;
  fornitoreStato: 'Da assegnare' | 'Magic Link Inviato' | 'Sopralluogo Oggi' | 'Consuntivo Caricato';
  dataSegnalazione: string;
  magicLinkUrl?: string;
}

const INITIAL_TICKETS: KanbanTicketItem[] = [
  {
    id: 'tck-101',
    codice: '#TK-204',
    titolo: 'Blocco cabina ascensore Scala A al piano 3',
    categoria: 'Ascensore',
    unita: 'Area Comune • Scala A',
    priorita: 'URGENTE',
    stato: 'APERTO',
    fornitoreNome: 'Otis / Kone Manutenzioni Srl',
    fornitoreStato: 'Da assegnare',
    dataSegnalazione: 'Oggi, 08:42',
  },
  {
    id: 'tck-102',
    codice: '#TK-203',
    titolo: 'Perdita valvola colonna montante acqua calda',
    categoria: 'Idraulica',
    unita: 'Scala B • Int. 07 (Sig.ra Monti)',
    priorita: 'ALTA',
    stato: 'LAVORAZIONE',
    fornitoreNome: 'TermoIdraulica Lombarda Spa',
    fornitoreStato: 'Sopralluogo Oggi',
    dataSegnalazione: 'Ieri, 17:15',
    magicLinkUrl: 'https://app.iocondo.it/fornitore/ml-98a7f6d2',
  },
  {
    id: 'tck-103',
    codice: '#TK-201',
    titolo: 'Sostituzione plafoniere LED androne ingresso',
    categoria: 'Elettricità',
    unita: 'Area Comune • Portineria',
    priorita: 'MEDIA',
    stato: 'LAVORAZIONE',
    fornitoreNome: 'ElettroService Milano Srl',
    fornitoreStato: 'Magic Link Inviato',
    dataSegnalazione: '23 Ott 2026',
    magicLinkUrl: 'https://app.iocondo.it/fornitore/ml-44c1b8e9',
  },
  {
    id: 'tck-104',
    codice: '#TK-198',
    titolo: 'Regolazione molla chiudiporta portone carraio',
    categoria: 'Fabbro / Accessi',
    unita: 'Cortile Principale',
    priorita: 'BASSA',
    stato: 'RISOLTO',
    fornitoreNome: 'Officine Sicurezza & Porte',
    fornitoreStato: 'Consuntivo Caricato',
    dataSegnalazione: '19 Ott 2026',
  },
];

const COLUMNS: { key: TicketColumnStatus; title: string; subtitle: string }[] = [
  { key: 'APERTO', title: 'Nuove Segnalazioni', subtitle: 'In attesa di presa in carico' },
  { key: 'LAVORAZIONE', title: 'In Lavorazione Fornitore', subtitle: 'Magic link attivo / Sopralluogo' },
  { key: 'RISOLTO', title: 'Risolti & Collaudati', subtitle: 'Pronti per imputazione spesa' },
];

export function TicketKanbanBoard({ loading = false }: { loading?: boolean }) {
  const [tickets, setTickets] = useState<KanbanTicketItem[]>(INITIAL_TICKETS);
  const [busyId, setBusyId] = useState<string | null>(null);

  const moveTicket = async (ticket: KanbanTicketItem, nextState: TicketColumnStatus) => {
    setBusyId(ticket.id);
    try {
      await services.ticket.cambiaStato(ticket.id, nextState).catch(() => null);
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticket.id) return t;
          const nextFornitoreStato =
            nextState === 'LAVORAZIONE'
              ? 'Magic Link Inviato'
              : nextState === 'RISOLTO'
                ? 'Consuntivo Caricato'
                : 'Da assegnare';
          return {
            ...t,
            stato: nextState,
            fornitoreStato: nextFornitoreStato,
            magicLinkUrl:
              nextState === 'LAVORAZIONE'
                ? t.magicLinkUrl ?? `https://app.iocondo.it/fornitore/token-${t.id}`
                : t.magicLinkUrl,
          };
        })
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          padding: 20,
        }}
      >
        <Skeleton style={{ height: 220 }} />
        <Skeleton style={{ height: 220 }} />
        <Skeleton style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fafafa' }}>
            Kanban Gestione Guasti & Stato Fornitori
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#a1a1aa' }}>
            Tracciamento end-to-end dei ticket con generazione Magic Link per fornitori esterni (UC-08).
          </p>
        </div>
        <Badge variant="outline">4 Interventi Attivi</Badge>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {COLUMNS.map((col) => {
          const items = tickets.filter((t) => t.stato === col.key);
          return (
            <div
              key={col.key}
              style={{
                backgroundColor: '#09090b',
                border: '1px solid #27272a',
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 10,
                  borderBottom: '1px solid #18181b',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>{col.title}</div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>{col.subtitle}</div>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    color: '#e4e4e7',
                  }}
                >
                  {items.length}
                </span>
              </div>

              {items.map((ticket) => (
                <div
                  key={ticket.id}
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: 9,
                    padding: 13,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#a1a1aa' }}>
                      {ticket.codice} • {ticket.categoria}
                    </span>
                    <Badge
                      variant={
                        ticket.priorita === 'URGENTE'
                          ? 'danger'
                          : ticket.priorita === 'ALTA'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {ticket.priorita}
                    </Badge>
                  </div>

                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#fafafa', lineHeight: 1.35 }}>
                      {ticket.titolo}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#a1a1aa', marginTop: 4 }}>{ticket.unita}</div>
                  </div>

                  {/* Stato Fornitore Box */}
                  <div
                    style={{
                      backgroundColor: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: 7,
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: '#e4e4e7',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <Wrench size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                        {ticket.fornitoreNome}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          marginTop: 2,
                          color:
                            ticket.fornitoreStato === 'Consuntivo Caricato'
                              ? '#34d399'
                              : ticket.fornitoreStato === 'Da assegnare'
                                ? '#f87171'
                                : '#fbbf24',
                        }}
                      >
                        Stato: {ticket.fornitoreStato}
                      </div>
                    </div>

                    {ticket.magicLinkUrl && (
                      <span
                        title={ticket.magicLinkUrl}
                        style={{
                          fontSize: 10.5,
                          color: '#34d399',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          flexShrink: 0,
                        }}
                      >
                        Magic Link <ExternalLink size={11} />
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#71717a' }}>{ticket.dataSegnalazione}</span>

                    {ticket.stato === 'APERTO' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId === ticket.id}
                        onClick={() => moveTicket(ticket, 'LAVORAZIONE')}
                      >
                        <Clock size={12} />
                        Invia Magic Link
                      </Button>
                    )}

                    {ticket.stato === 'LAVORAZIONE' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === ticket.id}
                        onClick={() => moveTicket(ticket, 'RISOLTO')}
                      >
                        <CheckCircle2 size={12} />
                        Chiudi Lavori
                      </Button>
                    )}

                    {ticket.stato === 'RISOLTO' && (
                      <span style={{ fontSize: 11.5, color: '#34d399', fontWeight: 600 }}>
                        ✓ Collaudato
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
