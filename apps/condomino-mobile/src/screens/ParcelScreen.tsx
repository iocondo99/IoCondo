import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRole } from '@/context/RoleContext';
import { XLButton } from '@/components/senior/XLButton';
import { services } from '@/services';

export interface ParcelItem {
  id: string;
  unitaId: string;
  internoLabel: string;
  destinatario: string;
  corriere: string;
  dataArrivo: string;
  stato: 'GIACENZA' | 'RITIRATO';
  sollecitoInviato?: boolean;
}

const INITIAL_PARCELS: ParcelItem[] = [
  {
    id: 'pacco-101',
    unitaId: '30000000-0000-0000-0000-000000000004',
    internoLabel: 'Scala A • Int. 04',
    destinatario: 'Fam. Bernardi - De Luca',
    corriere: 'Amazon Prime (Scatola Media)',
    dataArrivo: 'Oggi, ore 09:15',
    stato: 'GIACENZA',
  },
  {
    id: 'pacco-102',
    unitaId: '30000000-0000-0000-0000-000000000007',
    internoLabel: 'Scala B • Int. 07',
    destinatario: 'Sig.ra Carla Monti',
    corriere: 'DHL Express (Raccomandata / Pacco)',
    dataArrivo: 'Ieri, ore 15:40',
    stato: 'GIACENZA',
  },
  {
    id: 'pacco-103',
    unitaId: '30000000-0000-0000-0000-000000000011',
    internoLabel: 'Scala A • Int. 11',
    destinatario: 'Ing. Roberto Ferri',
    corriere: 'Bartolini BRT',
    dataArrivo: 'Oggi, ore 11:05',
    stato: 'GIACENZA',
  },
];

export function ParcelScreen({ embedded = false }: { embedded?: boolean }) {
  const { condominioId, condominioNome } = useRole();
  const [parcels, setParcels] = useState<ParcelItem[]>(INITIAL_PARCELS);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRegisterNewParcel = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newParcel: ParcelItem = {
      id: `pacco-${Date.now()}`,
      unitaId: '30000000-0000-0000-0000-000000000015',
      internoLabel: 'Scala B • Int. 15',
      destinatario: 'Avv. Giulia Visconti',
      corriere: 'SDA / Poste Italiane',
      dataArrivo: 'Adesso',
      stato: 'GIACENZA',
    };

    await services.servizi
      .registraPacco({
        condominio_id: condominioId,
        unita_destinazione_id: newParcel.unitaId,
        mittente_esterno: newParcel.corriere,
      })
      .catch(() => null);

    setParcels((prev) => [newParcel, ...prev]);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSendPushReminder = async (parcel: ParcelItem) => {
    setBusyId(parcel.id);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await services.servizi
        .sollecitaRitiroPacco({
          condominio_id: condominioId,
          unita_id: parcel.unitaId,
          titolo: '📦 Pacco in Portineria da ritirare',
          corpo: `Gentile ${parcel.destinatario} (${parcel.internoLabel}), c'è un pacco ${parcel.corriere} in giacenza in portineria.`,
        })
        .catch(() => null);

      setParcels((prev) =>
        prev.map((p) => (p.id === parcel.id ? { ...p, sollecitoInviato: true } : p))
      );

      Alert.alert(
        'Notifica Sollecito Inviata 🔔',
        `Push notification inviata a ${parcel.destinatario} (${parcel.internoLabel}).`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkCollected = async (parcel: ParcelItem) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await services.servizi.segnaRitirato(parcel.id, 'Ritiro firmato al banco portineria').catch(() => null);
    setParcels((prev) =>
      prev.map((p) => (p.id === parcel.id ? { ...p, stato: 'RITIRATO' } : p))
    );
  };

  const content = (
    <View style={styles.wrapper}>
      <View style={styles.portiereBanner}>
        <Text style={styles.bannerBadge}>MODALITÀ PORTIERE / STAFF ATTIVA</Text>
        <Text style={styles.bannerTitle}>Registro Pacchi & Giacenze per Interno</Text>
        <Text style={styles.bannerSub}>
          {condominioNome} • {parcels.filter((p) => p.stato === 'GIACENZA').length} pacchi in custodia
        </Text>
      </View>

      {/* BOTTONE RAPIDO "REGISTRA NUOVO PACCO" */}
      <XLButton
        icon="📦"
        title="+ REGISTRA NUOVO PACCO"
        subtitle="Aggiungi subito una consegna in giacenza per interno"
        variant="primary"
        onPress={handleRegisterNewParcel}
      />

      {/* LISTA DELLE GIACENZE PER INTERNO */}
      <View style={styles.listContainer}>
        {parcels.map((parcel) => (
          <View
            key={parcel.id}
            style={[
              styles.parcelCard,
              parcel.stato === 'RITIRATO' ? styles.parcelCardCollected : null,
            ]}
          >
            <View style={styles.cardTopRow}>
              <Text style={styles.internoBadge}>{parcel.internoLabel}</Text>
              <Text
                style={[
                  styles.statusBadge,
                  parcel.stato === 'GIACENZA' ? styles.statusGiacenza : styles.statusRitirato,
                ]}
              >
                {parcel.stato === 'GIACENZA' ? 'IN GIACENZA' : '✓ RITIRATO'}
              </Text>
            </View>

            <Text style={styles.recipientName}>{parcel.destinatario}</Text>
            <Text style={styles.courierText}>Corriere: {parcel.corriere}</Text>
            <Text style={styles.arrivalText}>Arrivo: {parcel.dataArrivo}</Text>

            {parcel.stato === 'GIACENZA' && (
              <View style={styles.cardButtons}>
                <XLButton
                  icon="🔔"
                  title={
                    parcel.sollecitoInviato
                      ? 'SOLLECITO PUSH INVIATO ✓'
                      : 'INVIA NOTIFICA SOLLECITO'
                  }
                  subtitle="Attiva la push notification sul telefono del residente"
                  variant="amber"
                  disabled={busyId === parcel.id}
                  onPress={() => handleSendPushReminder(parcel)}
                />

                <XLButton
                  icon="✍️"
                  title="CONSEGNA E SEGNA RITIRATO"
                  variant="outline"
                  onPress={() => handleMarkCollected(parcel)}
                />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  if (embedded) return content;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      {content}
    </ScrollView>
  );
}

export default ParcelScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 42,
  },
  wrapper: {
    gap: 16,
  },
  portiereBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
  },
  bannerBadge: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 4,
  },
  bannerSub: {
    color: '#CBD5E1',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  listContainer: {
    gap: 14,
  },
  parcelCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F172A',
    borderWidth: 2.5,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  parcelCardCollected: {
    opacity: 0.65,
    borderColor: '#64748B',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  internoBadge: {
    backgroundColor: '#E2E8F0',
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadge: {
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusGiacenza: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  statusRitirato: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  recipientName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  courierText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  arrivalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  cardButtons: {
    gap: 10,
    marginTop: 6,
  },
});
