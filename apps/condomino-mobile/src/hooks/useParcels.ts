import { useCallback, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useRole } from '@/context/RoleContext';
import { services } from '@/services';

type RegistraPaccoInput = Parameters<typeof services.servizi.registraPacco>[0];
type SollecitoInput = Parameters<typeof services.servizi.sollecitaRitiroPacco>[0];
export type Parcel = Awaited<ReturnType<typeof services.servizi.listPacchi>>[number];

export function useParcels() {
  const { condominioId, condominioNome } = useRole();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setParcels(await services.servizi.listPacchi(condominioId, { soloInGiacenza: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito');
    } finally {
      setLoading(false);
    }
  }, [condominioId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const registraPacco = async (input: Omit<RegistraPaccoInput, 'condominio_id'>) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await services.servizi.registraPacco({ ...input, condominio_id: condominioId } as RegistraPaccoInput);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registrazione non riuscita');
    }
  };

  const sollecita = async (parcelId: string, input: Omit<SollecitoInput, 'condominio_id'>) => {
    setBusyId(parcelId);
    try {
      await services.servizi.sollecitaRitiroPacco({ ...input, condominio_id: condominioId } as SollecitoInput);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sollecito non riuscito');
    } finally {
      setBusyId(null);
    }
  };

  const segnaRitirato = async (parcelId: string, firma: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await services.servizi.segnaRitirato(parcelId, firma);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
    }
  };

  return { condominioNome, parcels, loading, busyId, error, reload, registraPacco, sollecita, segnaRitirato };
}
