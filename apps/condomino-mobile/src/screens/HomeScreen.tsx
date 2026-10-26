import React from 'react';
import { ScrollView, View, Text, StyleSheet, Linking, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useRole } from '@/context/RoleContext';
import { SemaphoreBalanceCard } from '@/components/senior/SemaphoreBalanceCard';
import { XLButton } from '@/components/senior/XLButton';
import { ParcelScreen } from './ParcelScreen';

export function HomeScreen() {
  const router = useRouter();
  const {
    activeRole,
    setActiveRole,
    hasPortierePermission,
    condominioNome,
    unitaLabel,
    adminPhone,
    adminName,
    rataDaPagare,
    markRataAsPaid,
    resetDemoRata,
  } = useRole();

  const handleCallAdministrator = () => {
    void Linking.openURL(`tel:${adminPhone}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* BARRA SUPERIORE CON SELETTORE DI RUOLO CONDÒMINO / PORTIERE */}
      <View style={styles.headerBox}>
        <View>
          <Text style={styles.condominioTitle}>{condominioNome}</Text>
          <Text style={styles.unitaSubtitle}>
            {activeRole === 'CONDOMINO' ? `Residente • ${unitaLabel}` : 'Modalità Operativa Guardiola / Staff'}
          </Text>
        </View>

        {hasPortierePermission && (
          <View style={styles.roleSwitcherRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attiva modalità Condòmino"
              onPress={() => setActiveRole('CONDOMINO')}
              style={[
                styles.roleChip,
                activeRole === 'CONDOMINO' ? styles.roleChipActive : styles.roleChipInactive,
              ]}
            >
              <Text
                style={[
                  styles.roleChipText,
                  activeRole === 'CONDOMINO' ? styles.roleChipTextActive : styles.roleChipTextInactive,
                ]}
              >
                👤 Condòmino
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attiva modalità Portiere e Staff"
              onPress={() => setActiveRole('PORTIERE')}
              style={[
                styles.roleChip,
                activeRole === 'PORTIERE' ? styles.roleChipActive : styles.roleChipInactive,
              ]}
            >
              <Text
                style={[
                  styles.roleChipText,
                  activeRole === 'PORTIERE' ? styles.roleChipTextActive : styles.roleChipTextInactive,
                ]}
              >
                📦 Portiere / Staff
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* SE L'UTENTE È IN MODALITÀ PORTIERE MOSTRA DIRETTAMENTE LA CONSOLE PACCHI */}
      {activeRole === 'PORTIERE' ? (
        <ParcelScreen embedded />
      ) : (
        <>
          {/* 1. RIQUADRO SEMAFORICO SALDO (Verde: Tutto in Regola / Ambra: Rata da Pagare € 145,00) */}
          <SemaphoreBalanceCard
            rataDaPagare={rataDaPagare}
            condominioNome={condominioNome}
            unitaLabel={unitaLabel}
            onPaidSuccess={markRataAsPaid}
          />

          {/* Switch rapido dimostrativo per verificare entrambi gli stati del semaforo */}
          <Pressable onPress={rataDaPagare ? markRataAsPaid : resetDemoRata} style={styles.demoToggle}>
            <Text style={styles.demoToggleText}>
              {rataDaPagare
                ? 'Tocca qui per simulare vista "Tutto in Regola (Verde)"'
                : 'Tocca qui per simulare vista "Rata da Pagare (€ 145,00 Ambra)"'}
            </Text>
          </Pressable>

          {/* 2. AZIONE RAPIDA SEGNALAZIONE GUASTI VISIVA SENZA DIGITAZIONE */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>Hai visto un guasto in condominio?</Text>
            <XLButton
              icon="🛠️"
              title="SEGNALA UN GUASTO (SOLO 1 TOCCO)"
              subtitle="Scegli la figura e scatta una foto • Senza tastiera"
              variant="primary"
              onPress={() => router.push('/report-issue')}
            />
          </View>

          {/* 3. PULSANTE CHIAMA AMMINISTRATORE (DIALER TELEFONICO DIRETTO) */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>Hai bisogno di parlare a voce?</Text>
            <XLButton
              icon="📞"
              title="CHIAMA AMMINISTRATORE"
              subtitle={`${adminName} • Chiama subito al telefono`}
              variant="phone"
              onPress={handleCallAdministrator}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

export default HomeScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 18,
    paddingBottom: 42,
    gap: 20,
  },
  headerBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F172A',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  condominioTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  unitaSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  roleSwitcherRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  roleChip: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  roleChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  roleChipInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#475569',
  },
  roleChipText: {
    fontSize: 17,
    fontWeight: '800',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  roleChipTextInactive: {
    color: '#0F172A',
  },
  demoToggle: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  demoToggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionBox: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
});
