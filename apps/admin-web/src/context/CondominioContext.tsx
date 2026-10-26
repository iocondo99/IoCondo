'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ICondominio, IEsercizioContabile } from '@iocondo/shared-types';
import { services } from '@/services';

const DEFAULT_CONDOMINIO: ICondominio = {
  id: '10000000-0000-0000-0000-000000000001',
  admin_id: '00000000-0000-0000-0000-000000000001',
  nome: 'Residenza Parco Vittoria',
  tipo: 'SUPERCONDOMINIO',
  codice_fiscale: '97845120156',
  partita_iva: null,
  indirizzo: 'Via Monte Napoleone 24',
  citta: 'Milano',
  cap: '20121',
  provincia: 'MI',
  iban_principale: 'IT60X0542811101000000123456',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const FALLBACK_CONDOMINI: ICondominio[] = [
  DEFAULT_CONDOMINIO,
  {
    id: '10000000-0000-0000-0000-000000000002',
    admin_id: '00000000-0000-0000-0000-000000000001',
    nome: 'Torre Solaria — Porta Nuova',
    tipo: 'CONDOMINIO',
    codice_fiscale: '97412580159',
    partita_iva: null,
    indirizzo: 'Viale della Liberazione 15',
    citta: 'Milano',
    cap: '20124',
    provincia: 'MI',
    iban_principale: 'IT88K0306909606100000654321',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    admin_id: '00000000-0000-0000-0000-000000000001',
    nome: 'Condominio Giardini d’Ercole',
    tipo: 'CONDOMINIO',
    codice_fiscale: '91028374651',
    partita_iva: null,
    indirizzo: 'Corso Vittorio Emanuele II 88',
    citta: 'Torino',
    cap: '10121',
    provincia: 'TO',
    iban_principale: 'IT12A0200801600000109876543',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const DEFAULT_ESERCIZIO: IEsercizioContabile = {
  id: '20000000-0000-0000-0000-000000000001',
  condominio_id: '10000000-0000-0000-0000-000000000001',
  anno: 2026,
  data_inizio: '2026-01-01',
  data_fine: '2026-12-31',
  stato: 'PREVENTIVO',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const FALLBACK_ESERCIZI: Record<string, IEsercizioContabile> = {
  '10000000-0000-0000-0000-000000000001': DEFAULT_ESERCIZIO,
  '10000000-0000-0000-0000-000000000002': {
    id: '20000000-0000-0000-0000-000000000002',
    condominio_id: '10000000-0000-0000-0000-000000000002',
    anno: 2026,
    data_inizio: '2026-01-01',
    data_fine: '2026-12-31',
    stato: 'PREVENTIVO',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  '10000000-0000-0000-0000-000000000003': {
    id: '20000000-0000-0000-0000-000000000003',
    condominio_id: '10000000-0000-0000-0000-000000000003',
    anno: 2026,
    data_inizio: '2026-01-01',
    data_fine: '2026-12-31',
    stato: 'CONSUNTIVO',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
};

interface CondominioContextValue {
  condomini: ICondominio[];
  activeCondominio: ICondominio;
  setActiveCondominioId: (id: string) => void;
  activeEsercizio: IEsercizioContabile;
  loading: boolean;
  error: string | null;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  refreshCondomini: () => Promise<void>;
}

const CondominioContext = createContext<CondominioContextValue | undefined>(undefined);

export function CondominioProvider({ children }: { children: React.ReactNode }) {
  const [condomini, setCondomini] = useState<ICondominio[]>(FALLBACK_CONDOMINI);
  const [activeId, setActiveId] = useState<string>(DEFAULT_CONDOMINIO.id);
  const [activeEsercizio, setActiveEsercizio] = useState<IEsercizioContabile>(DEFAULT_ESERCIZIO);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remoteCondomini = await services.condomini.list();
      const firstCond = remoteCondomini[0];
      if (firstCond) {
        setCondomini(remoteCondomini);
        setActiveId(firstCond.id);
        const esercizi = await services.rate.listEsercizi(firstCond.id);
        const firstEs = esercizi[0];
        if (firstEs) {
          setActiveEsercizio(firstEs);
        }
      }
    } catch {
      setCondomini(FALLBACK_CONDOMINI);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const setActiveCondominioId = useCallback((id: string) => {
    setActiveId(id);
    const fallbackEs = FALLBACK_ESERCIZI[id];
    if (fallbackEs) {
      setActiveEsercizio(fallbackEs);
    }
    void services.rate
      .listEsercizi(id)
      .then((list) => {
        const first = list[0];
        if (first) setActiveEsercizio(first);
      })
      .catch(() => null);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return next;
    });
  }, []);

  const activeCondominio =
    condomini.find((c) => c.id === activeId) ?? condomini[0] ?? DEFAULT_CONDOMINIO;

  return (
    <CondominioContext.Provider
      value={{
        condomini,
        activeCondominio,
        setActiveCondominioId,
        activeEsercizio,
        loading,
        error,
        theme,
        toggleTheme,
        sidebarCollapsed,
        setSidebarCollapsed,
        commandPaletteOpen,
        setCommandPaletteOpen,
        refreshCondomini: loadData,
      }}
    >
      {children}
    </CondominioContext.Provider>
  );
}

export function useCondominio() {
  const ctx = useContext(CondominioContext);
  if (!ctx) {
    throw new Error('useCondominio deve essere usato dentro CondominioProvider');
  }
  return ctx;
}
