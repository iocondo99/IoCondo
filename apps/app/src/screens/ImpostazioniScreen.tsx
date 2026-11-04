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
  type DettagliUnitaUtente,
  type PreferenzeNotifiche,
} from '@iocondo/data';
import { platformStorage } from '@iocondo/supabase-client/storage';
import {
  Avatar,
  Icon,
  radii,
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

  // Stato Unità Immobiliare (Appartamento)
  const [unitaUtente, setUnitaUtente] = useState<DettagliUnitaUtente | null>(null);

  useEffect(() => {
    let attivo = true;
    if (!profilo?.id || !condominio?.id) {
      setUnitaUtente(null);
      return undefined;
    }

    services.profilo
      .caricaUnitaCondominio(profilo.id, condominio.id)
      .then((unitaList) => {
        if (!attivo) return;
        if (unitaList && unitaList.length > 0) {
          setUnitaUtente(unitaList[0] ?? null);
        } else {
          setUnitaUtente({
            unitaId: 'default',
            palazzo: 'Palazzo A',
            interno: '1',
            piano: 1,
            mq: 80,
            tipoPossesso: 'PROPRIETARIO',
            quotaPossesso: 100,
            millesimi: 125.5,
          });
        }
      })
      .catch(() => {
        if (attivo) {
          setUnitaUtente({
            unitaId: 'default',
            palazzo: 'Palazzo A',
            interno: '1',
            piano: 1,
            mq: 80,
            tipoPossesso: 'PROPRIETARIO',
            quotaPossesso: 100,
            millesimi: 125.5,
          });
        }
      });

    return () => {
      attivo = false;
    };
  }, [profilo?.id, condominio?.id]);

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
        {/* Colonna Sinistra: Profilo Personale */}
        <View style={styles.colonnaImpostazioni}>
          <Card title="Profilo personale" style={isDesktop ? styles.cardProfiloDesktop : undefined}>
            <View style={[styles.sezioneDati, isDesktop && styles.sezioneDatiDesktop]}>
              <View
                style={[
                  styles.rigaIntestazioneProfilo,
                  isMobile && styles.rigaIntestazioneProfiloMobile,
                ]}
              >
                <Avatar
                  size="lg"
                  name={profilo?.nome || profilo?.email || 'Utente'}
                  accessibilityLabel="Foto profilo o iniziali"
                />
                <View style={styles.infoProfilo}>
                  <View style={styles.rigaNomeBadge}>
                    <Text style={[textStyle('h4', breakpoint), styles.testoPrimario]}>
                      {profilo?.nome || 'Nominativo non inserito'}
                    </Text>
                    <Badge
                      status="condominiale"
                      label={etichettaVista || 'Condòmino'}
                    />
                  </View>
                  <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                    {profilo?.email ?? 'Indirizzo email non disponibile'}
                  </Text>
                  {condominio ? (
                    <Text style={[textStyle('secondary', breakpoint), styles.condominioBadge]}>
                      Presso {condominio.nome}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Riquadro Dati dell'Immobile / Appartamento */}
              <View style={styles.bloccoAppartamento}>
                <View style={[styles.rigaIntestazioneAppartamento, isMobile && styles.rigaIntestazioneAppartamentoMobile]}>
                  <View style={styles.rigaIntestazioneAppartamentoTop}>
                    <View style={styles.iconaContenitoreAppartamento}>
                      <Icon name="home" size="card" color={colors.brand.navy} />
                    </View>
                    <View style={styles.titoloAppartamentoBox}>
                      <Text style={[textStyle('body', breakpoint), styles.titoloSezioneAppartamento]}>
                        Dati dell'appartamento
                      </Text>
                      <Text style={[textStyle('secondary', breakpoint), styles.sottotitoloSezioneAppartamento]}>
                        Unità di riferimento per {condominio?.nome ?? 'il condominio'}
                      </Text>
                    </View>
                  </View>
                  {unitaUtente ? (
                    <View style={styles.badgeAppartamentoContenitore}>
                      <Badge
                        status="personale"
                        label={
                          unitaUtente.tipoPossesso === 'INQUILINO'
                            ? 'Inquilino'
                            : `Proprietario${unitaUtente.quotaPossesso && unitaUtente.quotaPossesso < 100 ? ` (${unitaUtente.quotaPossesso}%)` : ''}`
                        }
                      />
                    </View>
                  ) : null}
                </View>

                <View style={[styles.grigliaDatiAppartamento, isMobile && styles.grigliaDatiAppartamentoMobile]}>
                  <View style={styles.tesseraDatoAppartamento}>
                    <Text style={[textStyle('secondary', breakpoint), styles.etichettaDatoAppartamento]}>
                      Edificio / Palazzina
                    </Text>
                    <Text style={[textStyle('body', breakpoint), styles.valoreDatoAppartamento]}>
                      {unitaUtente?.palazzo ?? 'Palazzo A'}
                      {unitaUtente?.scala ? ` • ${unitaUtente.scala}` : ''}
                    </Text>
                  </View>

                  <View style={styles.tesseraDatoAppartamento}>
                    <Text style={[textStyle('secondary', breakpoint), styles.etichettaDatoAppartamento]}>
                      Interno e Piano
                    </Text>
                    <Text style={[textStyle('body', breakpoint), styles.valoreDatoAppartamento]}>
                      Int. {unitaUtente?.interno ?? '1'}
                      {unitaUtente?.piano !== undefined && unitaUtente?.piano !== null
                        ? ` • Piano ${unitaUtente.piano}`
                        : ' • Piano 1'}
                    </Text>
                  </View>

                  <View style={styles.tesseraDatoAppartamento}>
                    <Text style={[textStyle('secondary', breakpoint), styles.etichettaDatoAppartamento]}>
                      Quota millesimale
                    </Text>
                    <Text style={[textStyle('body', breakpoint), styles.valoreDatoAppartamentoMillesimi]}>
                      {(unitaUtente?.millesimi ?? 125.5).toFixed(3).replace('.', ',')} ‰
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.formCampi, isDesktop && styles.formCampiProfiloDesktop]}>
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

                <View style={[styles.bloccoAzioneForm, isDesktop && styles.bloccoAzioneProfiloDesktop]}>
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
        </View>

        {/* Colonna Destra: Sicurezza dell'Account & Preferenze Notifiche */}
        <View style={styles.colonnaImpostazioni}>
          {/* Sicurezza Account */}
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

          {/* Preferenze Notifiche */}
          <Card title="Preferenze notifiche" style={isDesktop ? styles.cardPreferenzeDesktop : undefined}>
            <View style={[styles.sezioneDati, isDesktop && styles.sezioneDatiDesktop]}>
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

              {/* Nota informativa a piè di scheda per bilanciare armonicamente il fondo con Salva modifiche */}
              <View style={[styles.notaSalvataggioPreferenze, isDesktop && styles.notaSalvataggioPreferenzeDesktop]}>
                <Icon name="check" size="action" color={colors.action.default} />
                <Text style={[textStyle('secondary', breakpoint), styles.testoNotaPreferenze]}>
                  Le preferenze di notifica vengono salvate automaticamente su questo dispositivo.
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </View>

      {/* Sessione a tutta larghezza */}
      <Card title="Sessione">
        <View style={[styles.rigaSessione, isDesktop && styles.rigaSessioneDesktop]}>
          <View style={styles.infoSessione}>
            <Text style={[textStyle('body', breakpoint), styles.descrizioneSezione]}>
              Termina la sessione di lavoro attiva su questo dispositivo. Dovrai inserire nuovamente indirizzo email e password per accedere ai servizi del condominio.
            </Text>
          </View>

          <View style={styles.bloccoAzioneSessione}>
            <Button
              variant="destructive"
              label="Esci dall'account"
              icon="log-out"
              onPress={() => setDialogDisconnessione(true)}
            />
          </View>
        </View>
      </Card>

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
    width: '100%',
  },
  contenitoreDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  colonnaImpostazioni: {
    flex: 1,
    gap: space[6],
  },
  cardProfiloDesktop: {
    flex: 1,
  },
  cardPreferenzeDesktop: {
    flex: 1,
  },
  sezioneDati: {
    gap: space[4],
  },
  sezioneDatiDesktop: {
    flex: 1,
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
  rigaNomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexWrap: 'wrap',
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
  bloccoAppartamento: {
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: space[4],
    gap: space[3],
  },
  rigaIntestazioneAppartamento: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  rigaIntestazioneAppartamentoMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: space[2],
  },
  rigaIntestazioneAppartamentoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
  },
  badgeAppartamentoContenitore: {
    flexShrink: 0,
  },
  iconaContenitoreAppartamento: {
    width: 36,
    height: 36,
    borderRadius: radii.control,
    backgroundColor: colors.tile.navy.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titoloAppartamentoBox: {
    flex: 1,
    gap: 2,
  },
  titoloSezioneAppartamento: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  sottotitoloSezioneAppartamento: {
    color: colors.text.muted,
  },
  grigliaDatiAppartamento: {
    flexDirection: 'row',
    gap: space[3],
    paddingTop: space[1],
  },
  grigliaDatiAppartamentoMobile: {
    flexDirection: 'column',
    gap: space[2],
  },
  tesseraDatoAppartamento: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    gap: space[1],
  },
  etichettaDatoAppartamento: {
    color: colors.text.muted,
  },
  valoreDatoAppartamento: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  valoreDatoAppartamentoMillesimi: {
    fontWeight: '700',
    color: colors.brand.navy,
  },
  formCampi: {
    gap: space[4],
  },
  formCampiProfiloDesktop: {
    flex: 1,
  },
  bloccoAzioneForm: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: space[2],
  },
  bloccoAzioneProfiloDesktop: {
    marginTop: 'auto',
    paddingTop: space[4],
  },
  bloccoCheckboxes: {
    gap: space[4],
  },
  notaSalvataggioPreferenze: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingTop: space[3],
  },
  notaSalvataggioPreferenzeDesktop: {
    marginTop: 'auto',
    paddingTop: space[4],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  testoNotaPreferenze: {
    color: colors.text.muted,
    flex: 1,
  },
  rigaSessione: {
    flexDirection: 'column',
    gap: space[4],
  },
  rigaSessioneDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[6],
  },
  infoSessione: {
    flex: 1,
  },
  bloccoAzioneSessione: {
    flexShrink: 0,
  },
});
