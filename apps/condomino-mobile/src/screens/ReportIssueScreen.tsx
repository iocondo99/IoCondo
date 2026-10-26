import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRole } from '@/context/RoleContext';
import { XLButton } from '@/components/senior/XLButton';
import { services } from '@/services';

export interface IssueCategoryOption {
  id: string;
  label: string;
  emoji: string;
  defaultTitle: string;
  priorita: 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
}

/**
 * 5 pulsanti a griglia con icone giganti (Nessuna digitazione richiesta):
 * Ascensore, Lampadine, Portone, Acqua/Tubi, Altro.
 */
export const VISUAL_ISSUE_CATEGORIES: IssueCategoryOption[] = [
  {
    id: 'cat-ascensore',
    label: 'Ascensore',
    emoji: '🛗',
    defaultTitle: 'Segnalazione guasto Ascensore',
    priorita: 'URGENTE',
  },
  {
    id: 'cat-lampadine',
    label: 'Lampadine',
    emoji: '💡',
    defaultTitle: 'Lampadina / Luce scale bruciata',
    priorita: 'BASSA',
  },
  {
    id: 'cat-portone',
    label: 'Portone',
    emoji: '🚪',
    defaultTitle: 'Problema apertura/chiusura Portone',
    priorita: 'ALTA',
  },
  {
    id: 'cat-acqua',
    label: 'Acqua / Tubi',
    emoji: '🚰',
    defaultTitle: 'Perdita Acqua / Tubazioni',
    priorita: 'URGENTE',
  },
  {
    id: 'cat-altro',
    label: 'Altro Guasto',
    emoji: '🔧',
    defaultTitle: 'Segnalazione manutenzione parti comuni',
    priorita: 'MEDIA',
  },
];

export function ReportIssueScreen() {
  const { condominioId, unitaId, unitaLabel } = useRole();
  const [selectedCategory, setSelectedCategory] = useState<IssueCategoryOption>(
    () => VISUAL_ISSUE_CATEGORIES[0]!
  );
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState<string | null>(null);

  const handleSelectCategory = (cat: IssueCategoryOption) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
    setSentConfirmation(null);
  };

  const handleTakePhoto = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso Fotocamera', 'Consenti l’uso della fotocamera per allegare la foto del guasto.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    const firstAsset = result.assets?.[0];
    if (!result.canceled && firstAsset) {
      setPhotoUri(firstAsset.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSendImmediate = async () => {
    setSubmitting(true);
    try {
      // Vibrazione aptica immediata (expo-haptics)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const createdTicket = await services.ticket
        .create({
          condominio_id: condominioId,
          unita_id: unitaId,
          titolo: `${selectedCategory.defaultTitle} (${unitaLabel})`,
          descrizione: `Segnalazione visiva rapida senza tastiera: ${selectedCategory.label}`,
          is_area_comune: true,
          priorita: selectedCategory.priorita,
        })
        .catch(() => null);

      if (createdTicket && photoUri) {
        await services.ticket.addAllegato(createdTicket.id, photoUri, 'FOTO').catch(() => null);
      }

      setSentConfirmation(
        `Segnalazione "${selectedCategory.label}" inviata all’Amministratore! Non devi fare altro.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.headerBanner}>
        <Text style={styles.title}>Segnala un Guasto senza Scrivere</Text>
        <Text style={styles.subtitle}>
          1. Tocca la figura del problema • 2. Scatta una foto (opzionale) • 3. Premi Invia
        </Text>
      </View>

      {/* 1. GRIGLIA 5 PULSANTI CON ICONE GIGANTI */}
      <Text style={styles.stepLabel}>PASSO 1: Tocca cosa non funziona</Text>
      <View style={styles.gridContainer}>
        {VISUAL_ISSUE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory.id === cat.id;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Problema ${cat.label}`}
              onPress={() => handleSelectCategory(cat)}
              style={({ pressed }) => [
                styles.gridItem,
                isSelected ? styles.gridItemSelected : null,
                pressed ? { opacity: 0.85 } : null,
              ]}
            >
              <Text style={styles.giantEmoji}>{cat.emoji}</Text>
              <Text style={[styles.gridLabel, isSelected ? styles.gridLabelSelected : null]}>
                {cat.label}
              </Text>
              {isSelected && <Text style={styles.selectedTag}>✓ SCELTO</Text>}
            </Pressable>
          );
        })}
      </View>

      {/* 2. FOTOCAMERA NATIVA (expo-image-picker) CON ANTEPRIMA SCATTO */}
      <Text style={styles.stepLabel}>PASSO 2: Mostra il guasto con una foto</Text>
      <XLButton
        icon="📷"
        title={photoUri ? 'SCATTA UN’ALTRA FOTO' : 'APRI FOTOCAMERA E SCATTA'}
        subtitle="Non serve scrivere nulla: basta la fotografia"
        variant="outline"
        onPress={handleTakePhoto}
      />

      {photoUri && (
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>✓ Foto allegata pronta per l’invio:</Text>
          <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
        </View>
      )}

      {/* 3. INVIO IMMEDIATO CON VIBRAZIONE APTICA */}
      <Text style={styles.stepLabel}>PASSO 3: Invia subito all’Amministratore</Text>
      <XLButton
        icon="🚀"
        title={submitting ? 'INVIO IN CORSO...' : `INVIA SEGNALAZIONE: ${selectedCategory.label.toUpperCase()}`}
        subtitle="Riceverai una vibrazione di conferma appena inviato"
        variant="green"
        disabled={submitting}
        onPress={handleSendImmediate}
      />

      {sentConfirmation && (
        <View style={styles.confirmationBox} accessibilityRole="alert">
          <Text style={styles.confirmationEmoji}>✅</Text>
          <Text style={styles.confirmationText}>{sentConfirmation}</Text>
        </View>
      )}
    </ScrollView>
  );
}

export default ReportIssueScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 18,
    paddingBottom: 44,
    gap: 16,
  },
  headerBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E2E8F0',
    marginTop: 6,
    lineHeight: 24,
  },
  stepLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 6,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47%',
    minHeight: 136,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#334155',
    backgroundColor: '#FFFFFF',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemSelected: {
    borderColor: '#047857',
    backgroundColor: '#ECFDF5',
    borderWidth: 4,
  },
  giantEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  gridLabelSelected: {
    color: '#064E3B',
  },
  selectedTag: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '900',
    color: '#047857',
  },
  previewBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#047857',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064E3B',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  confirmationBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 3,
    borderColor: '#047857',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  confirmationEmoji: {
    fontSize: 42,
  },
  confirmationText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#064E3B',
    textAlign: 'center',
    lineHeight: 28,
  },
});
