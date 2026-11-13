import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, ErrorState, Icon, Select, colors, radii, space, textStyle } from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';
import { SessionLoading } from '@/components/auth/SessionLoading';
import { useAuth } from '@/context/AuthContext';
import { useProfilo } from '@/context/ProfiloContext';
import { AppLayout } from './AppLayout';

/**
 * Prima del layout: caricamento del profilo, errore con "Riprova", account senza ruoli e
 * guardia di sospensione condominio (`attivo === false` per utenti non SUPER_ADMIN).
 * In questi casi non si mostra il menu e le pagine non eseguono query operative.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const profilo = useProfilo();
  const { signOut } = useAuth();

  const errore = profilo.stato === 'errore';
  const caricamento = profilo.stato === 'caricamento';
  const pronto = profilo.stato === 'pronto' && !profilo.senzaRuoli;
  const condominioSospeso =
    pronto && !profilo.profilo?.isSuperAdmin && profilo.condominio?.attivo === false;
  const mostraLayout = pronto && !condominioSospeso;
  const altriCondomini = profilo.profilo?.condomini ?? [];

  // Le pagine (children) restano SEMPRE montate nella stessa posizione, anche mentre si carica il
  // profilo: se il router non trovarsse la rotta richiesta al primo disegno, dopo l'accesso tornerebbe a "/".
  // Caricamento, errore, "nessun ruolo" e "condominio sospeso" si mostrano al loro posto e il layout resta nascosto.
  return (
    <>
      {caricamento ? <SessionLoading message="Carichiamo il tuo profilo…" /> : null}
      {!caricamento && !pronto ? (
        <View style={styles.root}>
          <BrandMark tone="light" />
          <View style={styles.blocco}>
            {errore ? (
              <ErrorState
                title="Non riusciamo a caricare il tuo profilo"
                description="Controlla la connessione e riprova."
                onRetry={profilo.riprova}
              />
            ) : (
              <EmptyState
                icon="lock"
                title="Account non ancora attivo"
                description="Il tuo account non è ancora associato a nessun condominio. Contatta il tuo amministratore."
              />
            )}
            <View style={styles.azioni}>
              <Button
                variant="secondary"
                label="Esci"
                icon="log-out"
                onPress={async () => {
                  await signOut();
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
      {condominioSospeso ? (
        <View style={styles.root}>
          <BrandMark tone="light" />
          <View style={styles.sospesoWrapper}>
            <Card>
              <View style={styles.sospesoCard}>
                <View style={styles.sospesoIconTile}>
                  <Icon name="shield-alert" size="card" color={colors.semantic.error.foreground} />
                </View>
                <Text style={[textStyle('h2'), styles.sospesoTitolo]}>
                  Servizio momentaneamente sospeso
                </Text>
                {profilo.condominio?.nome ? (
                  <View style={styles.sospesoBadge}>
                    <Icon name="building-2" size="indicator" color={colors.semantic.error.foreground} />
                    <Text style={[textStyle('label'), styles.sospesoBadgeTesto]}>
                      Condominio Sospeso: {profilo.condominio.nome}
                    </Text>
                  </View>
                ) : null}
                <Text style={[textStyle('body'), styles.sospesoDescrizione]}>
                  L&apos;accesso ai servizi digitali per questo condominio è temporaneamente sospeso per questioni
                  amministrative. Contatta l&apos;amministratore per maggiori informazioni.
                </Text>
                {altriCondomini.length > 1 && profilo.condominio ? (
                  <View style={styles.selettoreBox}>
                    <Select
                      label="Passa a un altro condominio"
                      value={profilo.condominio.id}
                      onChange={profilo.setCondominioId}
                      options={altriCondomini.map((c) => ({
                        value: c.id,
                        label: c.attivo === false ? `${c.nome} (Sospeso)` : c.nome,
                      }))}
                    />
                  </View>
                ) : null}
                <View style={styles.azioni}>
                  <Button
                    variant="secondary"
                    label="Esci dall'account"
                    icon="log-out"
                    onPress={async () => {
                      await signOut();
                    }}
                  />
                </View>
              </View>
            </Card>
          </View>
        </View>
      ) : null}
      <View aria-hidden={!mostraLayout} style={mostraLayout ? styles.layout : styles.nascosto}>
        <AppLayout>{children}</AppLayout>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[6],
    padding: space[4],
  },
  blocco: { alignItems: 'center', gap: space[4], width: '100%' },
  azioni: { width: '100%', flexDirection: 'row', justifyContent: 'center' },
  sospesoWrapper: { width: '100%', maxWidth: 520 },
  sospesoCard: { alignItems: 'center', gap: space[4] },
  sospesoIconTile: {
    width: 56,
    height: 56,
    borderRadius: radii.card,
    backgroundColor: colors.semantic.error.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sospesoTitolo: { color: colors.text.primary, textAlign: 'center' },
  sospesoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.badge,
    backgroundColor: colors.semantic.error.background,
  },
  sospesoBadgeTesto: { color: colors.semantic.error.foreground },
  sospesoDescrizione: { color: colors.text.secondary, textAlign: 'center' },
  selettoreBox: { width: '100%' },
  layout: { flex: 1 },
  nascosto: { display: 'none' },
});
