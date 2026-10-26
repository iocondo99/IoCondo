import React, { createContext, useContext, useState } from 'react';
import type { RuoloCodice } from '@iocondo/shared-types';

export interface ActiveRataDue {
  id: string;
  importo: number;
  importoFormatted: string;
  scadenza: string;
  descrizione: string;
  ibanCondominio: string;
}

interface RoleContextValue {
  activeRole: Extract<RuoloCodice, 'CONDOMINO' | 'PORTIERE'>;
  setActiveRole: (role: Extract<RuoloCodice, 'CONDOMINO' | 'PORTIERE'>) => void;
  hasPortierePermission: boolean;
  condominioId: string;
  condominioNome: string;
  unitaId: string;
  unitaLabel: string;
  adminPhone: string;
  adminName: string;
  rataDaPagare: ActiveRataDue | null;
  markRataAsPaid: () => void;
  resetDemoRata: () => void;
}

const DEFAULT_RATA: ActiveRataDue = {
  id: '40000000-0000-0000-0000-000000000001',
  importo: 145.0,
  importoFormatted: '€ 145,00',
  scadenza: '30 Novembre 2026',
  descrizione: 'Rata Ordinaria IV Trimestre 2026',
  ibanCondominio: 'IT60X0542811101000000123456',
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRole] = useState<'CONDOMINO' | 'PORTIERE'>('CONDOMINO');
  const [rataDaPagare, setRataDaPagare] = useState<ActiveRataDue | null>(DEFAULT_RATA);

  return (
    <RoleContext.Provider
      value={{
        activeRole,
        setActiveRole,
        hasPortierePermission: true,
        condominioId: '10000000-0000-0000-0000-000000000001',
        condominioNome: 'Residenza Parco Vittoria',
        unitaId: '30000000-0000-0000-0000-000000000004',
        unitaLabel: 'Scala A • Interno 4',
        adminPhone: '+390289456123',
        adminName: 'Studio Dott. Marco Rossi',
        rataDaPagare,
        markRataAsPaid: () => setRataDaPagare(null),
        resetDemoRata: () => setRataDaPagare(DEFAULT_RATA),
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole deve essere usato dentro RoleProvider');
  }
  return ctx;
}
