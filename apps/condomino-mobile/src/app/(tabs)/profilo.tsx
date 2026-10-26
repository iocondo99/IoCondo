import React from 'react';
import { ScrollView, View, Text, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useRole } from '@/context/RoleContext';
import { XLButton } from '@/components/senior/XLButton';

export default function ProfiloAiutoRoute() {
  const router = useRouter();
  const {
    activeRole,
    setActiveRole,
    condominioNome,
    unitaLabel,
    adminName,
    adminPhone,
  } = useRole();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.label}>IL TUO APPARTAMENTO</Text>
        <Text style={styles.name}>{condominioNome}</Text>
        <Text style={styles.sub}>{unitaLabel}</Text>
      </View>

      <XLButton
        icon="📞"
        title="CHIAMA AMMINISTRATORE"
        subtitle={`${adminName} (${adminPhone})`}
        variant="phone"
        onPress={() => void Linking.openURL(`tel:${adminPhone}`)}
      />

      <XLButton
        icon="🛠️"
        title="SEGNALA UN GUASTO VISIVO"
        subtitle="Senza tastiera, con icone grandi"
        variant="primary"
        onPress={() => router.push('/report-issue')}
      />

      <XLButton
        icon="📦"
        title={
          activeRole === 'PORTIERE'
            ? 'TORNA A MODALITÀ CONDÒMINO'
            : 'APRI MODALITÀ PORTIERE / PACCHI'
        }
        subtitle="Gestione giacenze e notifiche sollecito"
        variant="outline"
        onPress={() => {
          setActiveRole(activeRole === 'PORTIERE' ? 'CONDOMINO' : 'PORTIERE');
          router.push('/parcels');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 18, paddingBottom: 40, gap: 16 },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  label: { fontSize: 15, fontWeight: '900', color: '#475569' },
  name: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  sub: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
});
