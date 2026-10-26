import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

export default function AvvisiBachecaRoute() {
  const avvisi = [
    {
      id: 'avv-1',
      tag: 'IMPORTANTE',
      titolo: 'Controllo annuale caldaia condominiale',
      data: 'Giovedì 5 Novembre • Ore 09:00 - 12:00',
      corpo: 'I tecnici incaricati accederanno al locale caldaia. Non è necessario restare in casa.',
    },
    {
      id: 'avv-2',
      tag: 'PULIZIE',
      titolo: 'Lavaggio straordinario cortile e androne',
      data: 'Lunedì 2 Novembre • Ore 08:30',
      corpo: 'Si prega di fare attenzione al pavimento bagnato.',
    },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Avvisi dall’Amministratore</Text>
      {avvisi.map((a) => (
        <View key={a.id} style={styles.card}>
          <Text style={styles.badge}>{a.tag}</Text>
          <Text style={styles.title}>{a.titolo}</Text>
          <Text style={styles.date}>{a.data}</Text>
          <Text style={styles.body}>{a.corpo}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 18, paddingBottom: 40, gap: 16 },
  heading: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontWeight: '900',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  date: { fontSize: 18, fontWeight: '700', color: '#1D4ED8' },
  body: { fontSize: 19, fontWeight: '600', color: '#334155', lineHeight: 27 },
});
