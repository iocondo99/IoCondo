import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRole } from '@/context/RoleContext';
import { SemaphoreBalanceCard } from '@/components/senior/SemaphoreBalanceCard';

export default function SpeseRicevuteRoute() {
  const { condominioNome, unitaLabel, rataDaPagare, markRataAsPaid } = useRole();

  const storicoRicevute = [
    { id: 'ric-3', titolo: 'Rata III Trimestre Ordinaria 2026', importo: '€ 145,00', data: 'Pagata il 14 Set 2026' },
    { id: 'ric-2', titolo: 'Rata II Trimestre Ordinaria 2026', importo: '€ 145,00', data: 'Pagata il 10 Giu 2026' },
    { id: 'ric-1', titolo: 'Rata I Trimestre Ordinaria 2026', importo: '€ 145,00', data: 'Pagata il 12 Mar 2026' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <SemaphoreBalanceCard
        rataDaPagare={rataDaPagare}
        condominioNome={condominioNome}
        unitaLabel={unitaLabel}
        onPaidSuccess={markRataAsPaid}
      />

      <Text style={styles.sectionTitle}>Ricevute Pagamenti Precedenti</Text>
      {storicoRicevute.map((r) => (
        <View key={r.id} style={styles.receiptCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.receiptAmount}>{r.importo}</Text>
            <Text style={styles.paidPill}>✓ SALDATA</Text>
          </View>
          <Text style={styles.receiptTitle}>{r.titolo}</Text>
          <Text style={styles.receiptDate}>{r.data}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 18, paddingBottom: 40, gap: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginTop: 8 },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#0F172A',
    borderRadius: 14,
    padding: 18,
    gap: 6,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptAmount: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  paidPill: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  receiptTitle: { fontSize: 19, fontWeight: '800', color: '#1E293B' },
  receiptDate: { fontSize: 17, fontWeight: '600', color: '#475569' },
});
