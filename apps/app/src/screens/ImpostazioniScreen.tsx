import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CHIAVE_PREFERENZE,
  PREFERENZE_NOTIFICHE_DEFAULT,
  classifyPasswordError,
  normalizzaPreferenzeNotifiche,
  passwordFailureMessage,
  validaNomeCognome,
  validaTelefono,
  validateNewPassword,
  validatePasswordConfirm,
  weakPasswordReasons,
  type PreferenzeNotifiche,
} from '@iocondo/data';
import { platformStorage } from '@iocondo/supabase-client/storage';
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Input,
  PageHeader,
  borderWidths,
  colors,
  layout,
  space,
  textStyle,
  useBreakpoint,
  useToast,
} from '@iocondo/ui';
import { useAuth } from '@/context/AuthContext';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function ImpostazioniScreen() {
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useAuth();
  const { profilo, condominio, etichettaVista, riprova } = useProfilo();
  const { breakpoint, isDesktop, isMobile } = useBreakpoint();

  // Stato Anagrafica
  const [nome, setNome] = useState(profilo?.nome ?? '');
  const [telefono, setTelefono] = useState(profilo?.telefono ?? '');
  const [erroreNome, setErroreNome] = useState<string | undefined>();
  const [erroreTelefono, setErroreTelefono] = useState<string | undefined>();
  const [salvataggioAnagrafica, setSalvataggioAnagrafica] = useState(false);

  // Sincronizza stato anagrafica se cambia il profilo
  useEffect(() => {
    if (profilo) {
      setNome(profilo.nome ?? '');
      setTelefono(profilo.telefono ?? '');
    }
  }, [profilo]);

  // Stato Password
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');
  const [errorePassword, setErrorePassword] = useState<string | undefined>();
  const [erroreConferma, setErroreConferma] = useState<string | undefined>();
  const [salvataggioPassword, setSalvataggioPassword] = useState(false);

  // Stato Preferenze Notifiche
  const [notifiche, setNotifiche] = useState<PreferenzeNotifiche>(PREFERENZE_NOTIFICHE_DEFAULT);
  const [caricatePreferenze, setCaricatePreferenze] = useState(false);

  // Stato Dialog di Disconnessione
  const [dialogDisconnessione, setDialogDisconnessione] = useState(false);

  // Caricamento preferenze da memoria locale (iocondo.preferenze.v1)
  useEffect(() => {
    let attivo = true;
    platformStorage
      .getItem(CHIAVE_PREFERENZE)
      .then((grezzo) => {
        if (!attivo) return;
        if (grezzo) {
          try {
            const parsed = JSON.parse(grezzo) as { notifiche?: unknown };
            setNotifiche(normalizzaPreferenzeNotifiche(parsed.notifiche));
          } catch {
            setNotifiche(PREFERENZE_NOTIFICHE_DEFAULT);
          }
        }
        setCaricatePreferenze(true);
      })
      .catch(() => {
        if (attivo) setCaricatePreferenze(true);
      });
    return () => {
      attivo = false;
    };
  }, []);

  // Salvataggio preferenze notifiche
  const aggiornaNotifica = useCallback(
    async (chiave: keyof PreferenzeNotifiche, valore: boolean) => {
      const prossime: PreferenzeNotifiche = { ...notifiche, [chiave]: valore };
      setNotifiche(prossime);

      try {
        const grezzo = await platformStorage.getItem(CHIAVE_PREFERENZE);
        const correnti = grezzo ? (JSON.parse(grezzo) as Record<string, unknown>) : {};
        const salvate = { ...correnti, notifiche: prossime };
        await platformStorage.setItem(CHIAVE_PREFERENZE, JSON.stringify(salvate));
        toast.show({
          tone: 'success',
          message: 'Preferenze di notifica aggiornate con successo.',
        });
      } catch {
        toast.show({
          tone: 'error',
          message: 'Impossibile memorizzare le preferenze sul dispositivo.',
        });
      }
    },
    [notifiche, toast],
  );

  // Salvataggio Anagrafica
  const handleSalvaAnagrafica = async () => {
    if (!profilo) return;
    const errN = validaNomeCognome(nome);
    const errT = validaTelefono(telefono);
    setErroreNome(errN);
    setErroreTelefono(errT);

    if (errN || errT) return;

    setSalvataggioAnagrafica(true);
    try {
      await services.profilo.aggiornaAnagrafica(profilo.id, {
        nome_cognome: nome,
        telefono: telefono.trim() ? telefono.trim() : null,
      });
      riprova();
      toast.show({
        tone: 'success',
        message: 'Dati personali aggiornati con successo.',
      });
    } catch {
      toast.show({
        tone: 'error',
        message: 'Non è stato possibile aggiornare i tuoi dati. Riprova tra poco.',
      });
    } finally {
      setSalvataggioAnagrafica(false);
    }
  };

  // Cambio Password
  const handleCambiaPassword = async () => {
    const errP = validateNewPassword(nuovaPassword);
    const errC = validatePasswordConfirm(nuovaPassword, confermaPassword);
    setErrorePassword(errP);
    setErroreConferma(errC);

    if (errP || errC) return;

    setSalvataggioPassword(true);
    try {
      await services.profilo.cambiaPassword(nuovaPassword);
      setNuovaPassword('');
      setConfermaPassword('');
      toast.show({
        tone: 'success',
        message: 'Password aggiornata con successo.',
      });
    } catch (error) {
      const kind = classifyPasswordError(error);
      const msg = passwordFailureMessage(kind, weakPasswordReasons(error));
      setErrorePassword(msg);
      toast.show({
        tone: 'error',
        message: msg,
      });
    } finally {
      setSalvataggioPassword(false);
    }
  };

  // Disconnessione
  const handleDisconnetti = async () => {
    const res = await signOut();
    setDialogDisconnessione(false);
    if (res.ok) {
      router.replace('/login');
    } else {
      toast.show({
        tone: 'error',
        message: res.message,
      });
    }
  };

  const breadcrumbs = [
    { label: 'Home', onPress: () => router.push('/') },
    { label: 'Impostazioni' },
  ];

  return (
    <View style={styles.pagina}>
      <Breadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Impostazioni"
        subtitle="Gestisci le informazioni del tuo profilo, la sicurezza dell'account e le preferenze delle notifiche."
      />

      <View style={[styles.contenitore, isDesktop && styles.contenitoreDesktop]}>
        {/* 1. Profilo Personale */}
        <Card title="Profilo personale">
          <View style={styles.sezioneDati}>
            <View style={[styles.rigaIntestazioneProfilo, isMobile && styles.rigaIntestazioneProfiloMobile]}>
              <Avatar
                size="lg"
                name={profilo?.nome || profilo?.email || 'Utente'}
                accessibilityLabel="Foto profilo o iniziali"
              />
              <View style={styles.infoProfilo}>
                <Text style={[textStyle('h4', breakpoint), styles.testoPrimario]}>
                  {profilo?.nome || 'Nominativo non inserito'}
                </Text>
                <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                  {profilo?.email ?? 'Indirizzo email non disponibile'}
                </Text>
                <View style={styles.ruoliRiga}>
                  <Badge
                    status="condominiale"
                    label={etichettaVista || 'Residente'}
                  />
                  {condominio ? (
                    <Text style={[textStyle('secondary', breakpoint), styles.condominioBadge]}>
                      Presso {condominio.nome}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.formCampi}>
              <Input
                label="Nome e cognome"
                placeholder="es. Mario Rossi"
                value={nome}
                onChangeText={(val) => {
                  setNome(val);
                  if (erroreNome) setErroreNome(undefined);
                }}
                error={erroreNome}
                autoCapitalize="words"
                autoComplete="name"
                disabled={salvataggioAnagrafica}
              />

              <Input
                label="Recapito telefonico"
                placeholder="+39 06 1234567 o 333 1234567"
                helperText="Utilizzato dall'amministrazione per comunicazioni di servizio o urgenze."
                value={telefono}
                onChangeText={(val) => {
                  setTelefono(val);
                  if (erroreTelefono) setErroreTelefono(undefined);
                }}
                error={erroreTelefono}
                keyboardType="phone-pad"
                autoComplete="tel"
                disabled={salvataggioAnagrafica}
              />

              <Input
                label="Indirizzo email"
                value={profilo?.email ?? ''}
                helperText="L'indirizzo email di accesso è gestito centralmente dall'amministrazione."
                disabled
              />

              <View style={styles.bloccoAzioneForm}>
                <Button
                  variant="primary"
                  label="Salva modifiche"
                  icon="check"
                  onPress={handleSalvaAnagrafica}
                  loading={salvataggioAnagrafica}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* 2. Sicurezza Account */}
        <Card title="Sicurezza dell'account">
          <View style={styles.sezioneDati}>
            <Text style={[textStyle('body', breakpoint), styles.descrizioneSezione]}>
              Aggiorna la password con cui accedi alla piattaforma. Scegli una password robusta di almeno 8 caratteri.
            </Text>

            <View style={styles.formCampi}>
              <Input
                label="Nuova password"
                placeholder="Almeno 8 caratteri"
                variant="password"
                value={nuovaPassword}
                onChangeText={(val) => {
                  setNuovaPassword(val);
                  if (errorePassword) setErrorePassword(undefined);
                }}
                error={errorePassword}
                autoComplete="new-password"
                disabled={salvataggioPassword}
              />

              <Input
                label="Conferma nuova password"
                placeholder="Ripeti la password scelta"
                variant="password"
                value={confermaPassword}
                onChangeText={(val) => {
                  setConfermaPassword(val);
                  if (erroreConferma) setErroreConferma(undefined);
                }}
                error={erroreConferma}
                autoComplete="new-password"
                disabled={salvataggioPassword}
              />

              <View style={styles.bloccoAzioneForm}>
                <Button
                  variant="secondary"
                  label="Aggiorna password"
                  icon="lock"
                  onPress={handleCambiaPassword}
                  loading={salvataggioPassword}
                  disabled={!nuovaPassword || !confermaPassword}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* 3. Preferenze Notifiche */}
        <Card title="Preferenze notifiche">
          <View style={styles.sezioneDati}>
            <Text style={[textStyle('body', breakpoint), styles.descrizioneSezione]}>
              Personalizza le comunicazioni e gli avvisi che desideri ricevere su questo dispositivo.
            </Text>

            {caricatePreferenze ? (
              <View style={styles.bloccoCheckboxes}>
                <Checkbox
                  label="Notifiche email"
                  helperText="Ricevi convocazioni, comunicazioni ufficiali e resoconti per posta elettronica."
                  checked={notifiche.email}
                  onChange={(val) => aggiornaNotifica('email', val)}
                />

                <Checkbox
                  label="Avvisi bacheca e messaggi"
                  helperText="Mostra avvisi visivi quando viene pubblicato un nuovo post o messaggio."
                  checked={notifiche.bacheca}
                  onChange={(val) => aggiornaNotifica('bacheca', val)}
                />

                <Checkbox
                  label="Promemoria scadenze rate"
                  helperText="Ricevi un promemoria di avviso prima della data di scadenza dei pagamenti."
                  checked={notifiche.scadenzeRate}
                  onChange={(val) => aggiornaNotifica('scadenzeRate', val)}
                />
              </View>
            ) : null}
          </View>
        </Card>

        {/* 4. Disconnessione */}
        <Card title="Sessione">
          <View style={styles.sezioneDati}>
            <Text style={[textStyle('body', breakpoint), styles.descrizioneSezione]}>
              Termina la sessione di lavoro attiva su questo dispositivo.
            </Text>

            <View style={styles.bloccoAzioneForm}>
              <Button
                variant="destructive"
                label="Esci dall'account"
                icon="log-out"
                onPress={() => setDialogDisconnessione(true)}
              />
            </View>
          </View>
        </Card>
      </View>

      {/* Modale di conferma Disconnessione */}
      <ConfirmDialog
        visible={dialogDisconnessione}
        title="Disconnettersi dall'applicazione?"
        description="Dovrai inserire nuovamente indirizzo email e password per accedere ai servizi del condominio."
        confirmLabel="Esci"
        confirmLoadingLabel="Uscita in corso…"
        cancelLabel="Annulla"
        destructive
        onConfirm={handleDisconnetti}
        onCancel={() => setDialogDisconnessione(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    alignSelf: 'stretch',
    gap: space[6],
  },
  contenitore: {
    gap: space[6],
    maxWidth: layout.formMaxWidth,
    width: '100%',
  },
  contenitoreDesktop: {
    maxWidth: layout.formMaxWidth + 120,
  },
  sezioneDati: {
    gap: space[4],
  },
  descrizioneSezione: {
    color: colors.text.secondary,
  },
  rigaIntestazioneProfilo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingBottom: space[4],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  rigaIntestazioneProfiloMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  infoProfilo: {
    flex: 1,
    gap: space[1],
  },
  testoPrimario: {
    color: colors.text.primary,
  },
  testoSecondario: {
    color: colors.text.secondary,
  },
  ruoliRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[1],
    flexWrap: 'wrap',
  },
  condominioBadge: {
    color: colors.text.muted,
  },
  formCampi: {
    gap: space[4],
  },
  bloccoAzioneForm: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: space[2],
  },
  bloccoCheckboxes: {
    gap: space[4],
  },
});
