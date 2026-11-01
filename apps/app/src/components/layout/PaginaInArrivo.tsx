import React from 'react';
import { useRouter, type Href } from 'expo-router';
import { homeDi } from '@iocondo/data';
import { EmptyState, NonAutorizzato, PageHeader } from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';
import { useAccessoConsentito } from './GuardiaVista';

/**
 * Pagina segnaposto di una voce del menu. Se la voce non è tra quelle della vista attiva (ruolo
 * insufficiente o modulo disattivato) mostra "non disponibile" invece di aprirsi: nessun reindirizzamento
 * silenzioso. Senza pulsanti: non c'è ancora nulla da fare qui.
 */
export function PaginaInArrivo({ voceId }: { voceId: string }) {
  const { voci, vista } = useProfilo();
  const router = useRouter();
  const consentito = useAccessoConsentito();
  const voce = voci.find((v) => v.id === voceId);

  // Il gruppo di rotte ha già mostrato "non disponibile": qui non c'è altro da dire.
  if (!consentito) return null;

  if (!voce) {
    return (
      <NonAutorizzato
        title="Questa pagina non è disponibile"
        description="Il tuo profilo o le impostazioni del condominio non permettono di aprirla. Se pensi sia un errore, contatta l’amministratore."
        action={
          vista
            ? { label: 'Torna alla Home', icon: 'home', onPress: () => router.replace(homeDi(vista) as Href) }
            : undefined
        }
      />
    );
  }

  return (
    <>
      <PageHeader title={voce.label} />
      <EmptyState
        icon="hourglass"
        title="Questa sezione è in arrivo"
        description="Stiamo preparando questa pagina. Intanto puoi usare le altre voci del menu."
      />
    </>
  );
}
