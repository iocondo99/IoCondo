import { useState } from 'react';
import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import type { ActiveRataDue } from '@/context/RoleContext';
import { services } from '@/services';

function buildBollettinoHtml(rata: ActiveRataDue, condominioNome: string, unitaLabel: string): string {
  return `<!DOCTYPE html>
<html lang="it">
  <head><meta charset="utf-8" /><title>Avviso di Pagamento Condominiale</title></head>
  <body>
    <h1>Bollettino rata condominiale</h1>
    <p>Condominio: ${condominioNome}</p>
    <p>Unità: ${unitaLabel}</p>
    <p>Causale: ${rata.descrizione}</p>
    <p>Scadenza: ${rata.scadenza}</p>
    <p>IBAN: ${rata.ibanCondominio}</p>
    <p>Importo: ${rata.importoFormatted}</p>
  </body>
</html>`;
}

export function useRataPayment(rata: ActiveRataDue | null, condominioNome: string, unitaLabel: string) {
  const [paying, setPaying] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (): Promise<boolean> => {
    if (!rata) return false;
    setPaying(true);
    setError(null);
    try {
      await services.rate.avviaPagamento({
        rataId: rata.id,
        importo: rata.importo,
        metodo: 'CARTA',
        provider: 'STRIPE',
        providerRef: `1tap_${Date.now()}`,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pagamento non riuscito');
      return false;
    } finally {
      setPaying(false);
    }
  };

  const printBollettino = async (): Promise<boolean> => {
    if (!rata) return false;
    setPrinting(true);
    setError(null);
    try {
      await Print.printAsync({ html: buildBollettinoHtml(rata, condominioNome, unitaLabel) });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stampa non riuscita');
      return false;
    } finally {
      setPrinting(false);
    }
  };

  return { paying, printing, error, pay, printBollettino };
}
