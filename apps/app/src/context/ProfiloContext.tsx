import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { platformStorage } from '@iocondo/supabase-client/storage';
import type { INavVoce, RuoloCodice } from '@iocondo/shared-types';
import {
  etichettaVista,
  ruoliIn,
  scegliCondominio,
  scegliVista,
  senzaRuoli,
  vistePossibili,
  vociDi,
  DEFAULT_MODULI_ATTIVI,
  type CondominioBreve,
  type ModuliAttivi,
  type ProfiloUtente,
  type Vista,
} from '@iocondo/data';
import { services } from '@/services';
import { useAuth } from './AuthContext';

type Caricamento = { stato: 'caricamento' } | { stato: 'errore' } | { stato: 'pronto'; profilo: ProfiloUtente };
type StatoModuli = { stato: 'nessuno' } | { stato: 'caricamento' } | { stato: 'errore' } | { stato: 'pronto'; moduli: ModuliAttivi };

interface Preferenze {
  condominioId?: string;
  vista?: Vista;
}

const CHIAVE_PREFERENZE = 'iocondo.preferenze.v1';

interface ProfiloContextValue {
  /** `pronto` solo quando profilo e moduli del condominio sono letti: finché non lo è, niente menu a metà. */
  stato: 'caricamento' | 'errore' | 'pronto';
  riprova: () => void;
  profilo: ProfiloUtente | null;
  /** true se l'utente non ha né condomini né il flag super amministratore. */
  senzaRuoli: boolean;
  condominio: CondominioBreve | null;
  setCondominioId: (id: string) => void;
  vista: Vista | null;
  viste: Vista[];
  setVista: (vista: Vista) => void;
  /** Ruoli dell'utente nel condominio scelto. */
  ruoli: ReadonlySet<RuoloCodice>;
  /** Moduli attivi nel condominio scelto. */
  moduli: ModuliAttivi;
  /** Ricarica i moduli attivi da Supabase. */
  ricaricaModuli: () => Promise<void>;
  /** Aggiorna immediatamente lo stato locale dei moduli (reattività ottimistica). */
  aggiornaModuli: (nuovi: ModuliAttivi) => void;
  /** Nome della vista attiva, come lo vede l'utente. */
  etichettaVista: string;
  voci: INavVoce[];
  etichettaDi: (vista: Vista) => string;
}

const ProfiloContext = createContext<ProfiloContextValue | undefined>(undefined);

async function leggiPreferenze(): Promise<Preferenze> {
  try {
    const grezzo = await platformStorage.getItem(CHIAVE_PREFERENZE);
    return grezzo ? (JSON.parse(grezzo) as Preferenze) : {};
  } catch {
    return {};
  }
}

/**
 * Profilo reale dell'utente che ha fatto l'accesso: nome, ruoli, condomini, moduli attivi e vista scelta.
 * Niente dati dimostrativi: se il database non assegna ruoli, `senzaRuoli` è true. La scelta di
 * condominio e vista si ricorda sul dispositivo. La sicurezza vera resta nelle RLS di Supabase.
 */
export function ProfiloProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const email = user?.email ?? null;
  const [caricamento, setCaricamento] = useState<Caricamento>({ stato: 'caricamento' });
  const [preferenze, setPreferenze] = useState<Preferenze | null>(null);
  const [statoModuli, setStatoModuli] = useState<StatoModuli>({ stato: 'nessuno' });
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let attivo = true;
    setCaricamento({ stato: 'caricamento' });
    Promise.all([services.profilo.carica(userId, email), leggiPreferenze()])
      .then(([profilo, salvate]) => {
        if (!attivo) return;
        setPreferenze(salvate);
        setCaricamento({ stato: 'pronto', profilo });
      })
      .catch(() => {
        if (attivo) setCaricamento({ stato: 'errore' });
      });
    return () => {
      attivo = false;
    };
  }, [userId, email, tentativo]);

  const profilo = caricamento.stato === 'pronto' ? caricamento.profilo : null;
  const condominioId = profilo ? scegliCondominio(profilo, preferenze?.condominioId) : null;
  const condominioCorrente = profilo?.condomini.find((c) => c.id === condominioId) ?? null;
  const condominioSospeso = Boolean(!profilo?.isSuperAdmin && condominioCorrente?.attivo === false);
  const vista = profilo ? scegliVista(profilo, condominioId, preferenze?.vista) : null;

  useEffect(() => {
    if (!condominioId) {
      setStatoModuli({ stato: 'nessuno' });
      return undefined;
    }
    if (condominioSospeso) {
      // Condominio sospeso: nessuna query operativa su configurazioni_condominio
      setStatoModuli({ stato: 'pronto', moduli: DEFAULT_MODULI_ATTIVI });
      return undefined;
    }
    let attivo = true;
    setStatoModuli({ stato: 'caricamento' });
    services.condomini
      .getFeatureToggles(condominioId)
      .then((moduli) => attivo && setStatoModuli({ stato: 'pronto', moduli }))
      .catch(() => attivo && setStatoModuli({ stato: 'errore' }));
    return () => {
      attivo = false;
    };
  }, [condominioId, condominioSospeso, tentativo]);

  const salva = useCallback((prossime: Preferenze) => {
    setPreferenze(prossime);
    void platformStorage.setItem(CHIAVE_PREFERENZE, JSON.stringify(prossime)).catch(() => undefined);
  }, []);

  const riprova = useCallback(() => setTentativo((n) => n + 1), []);

  const ricaricaModuli = useCallback(async () => {
    if (!condominioId) return;
    try {
      const moduli = await services.condomini.getFeatureToggles(condominioId);
      setStatoModuli({ stato: 'pronto', moduli });
    } catch {
      // Ignora l'errore transitorio per non resettare lo stato attuale
    }
  }, [condominioId]);

  const aggiornaModuli = useCallback((nuovi: ModuliAttivi) => {
    setStatoModuli({ stato: 'pronto', moduli: nuovi });
  }, []);

  const valore = useMemo<ProfiloContextValue>(() => {
    const ruoli = profilo ? ruoliIn(profilo, condominioId) : new Set<RuoloCodice>();
    const moduli = statoModuli.stato === 'pronto' ? statoModuli.moduli : null;
    const moduliPronti = !condominioId || statoModuli.stato === 'pronto';
    const stato: ProfiloContextValue['stato'] =
      caricamento.stato === 'errore' || statoModuli.stato === 'errore'
        ? 'errore'
        : caricamento.stato === 'pronto' && preferenze && moduliPronti
          ? 'pronto'
          : 'caricamento';
    const moduliEffettivi = moduli ?? DEFAULT_MODULI_ATTIVI;
    const voci =
      vista && (moduli || vista === 'SUPER_ADMIN')
        ? vociDi({
            vista,
            ruoli,
            moduli: moduliEffettivi,
          })
        : [];
    return {
      stato,
      riprova,
      profilo,
      senzaRuoli: profilo ? senzaRuoli(profilo) : false,
      condominio: profilo?.condomini.find((c) => c.id === condominioId) ?? null,
      setCondominioId: (id) => salva({ ...preferenze, condominioId: id }),
      vista,
      viste: profilo ? vistePossibili(profilo, condominioId) : [],
      setVista: (prossima) => salva({ ...preferenze, vista: prossima }),
      ruoli,
      moduli: moduliEffettivi,
      ricaricaModuli,
      aggiornaModuli,
      etichettaVista: vista ? etichettaVista(vista, ruoli) : '',
      voci,
      etichettaDi: (v) => etichettaVista(v, ruoli),
    };
  }, [caricamento, preferenze, statoModuli, profilo, condominioId, vista, riprova, salva, ricaricaModuli, aggiornaModuli]);

  return <ProfiloContext.Provider value={valore}>{children}</ProfiloContext.Provider>;
}

export function useProfilo(): ProfiloContextValue {
  const contesto = useContext(ProfiloContext);
  if (!contesto) throw new Error('useProfilo va usato dentro ProfiloProvider.');
  return contesto;
}
