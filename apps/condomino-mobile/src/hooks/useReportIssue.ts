import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRole } from '@/context/RoleContext';
import { services } from '@/services';

export interface IssueCategoryOption {
  id: string;
  label: string;
  defaultTitle: string;
  priorita: 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
}

export const ISSUE_CATEGORIES: IssueCategoryOption[] = [
  { id: 'cat-ascensore', label: 'Ascensore', defaultTitle: 'Segnalazione guasto Ascensore', priorita: 'URGENTE' },
  { id: 'cat-lampadine', label: 'Lampadine', defaultTitle: 'Lampadina / Luce scale bruciata', priorita: 'BASSA' },
  { id: 'cat-portone', label: 'Portone', defaultTitle: 'Problema apertura/chiusura Portone', priorita: 'ALTA' },
  { id: 'cat-acqua', label: 'Acqua / Tubi', defaultTitle: 'Perdita Acqua / Tubazioni', priorita: 'URGENTE' },
  { id: 'cat-altro', label: 'Altro Guasto', defaultTitle: 'Segnalazione manutenzione parti comuni', priorita: 'MEDIA' },
];

export function useReportIssue() {
  const { condominioId, unitaId, unitaLabel } = useRole();
  const [selectedCategory, setSelectedCategory] = useState<IssueCategoryOption>(() => ISSUE_CATEGORIES[0]!);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectCategory = (cat: IssueCategoryOption) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
    setSent(false);
  };

  /** Ritorna false se il permesso fotocamera è negato. */
  const takePhoto = async (): Promise<boolean> => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return false;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
    const firstAsset = result.assets?.[0];
    if (!result.canceled && firstAsset) {
      setPhotoUri(firstAsset.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    return true;
  };

  const send = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const createdTicket = await services.ticket.create({
        condominio_id: condominioId,
        unita_id: unitaId,
        titolo: `${selectedCategory.defaultTitle} (${unitaLabel})`,
        descrizione: `Segnalazione visiva rapida senza tastiera: ${selectedCategory.label}`,
        is_area_comune: true,
        priorita: selectedCategory.priorita,
      });
      if (photoUri) {
        await services.ticket.addAllegato(createdTicket.id, photoUri, 'FOTO');
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invio non riuscito');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    categories: ISSUE_CATEGORIES,
    selectedCategory,
    photoUri,
    submitting,
    sent,
    error,
    selectCategory,
    takePhoto,
    send,
  };
}
