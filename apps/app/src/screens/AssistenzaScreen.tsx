import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { type DatiAssistenza } from '@iocondo/data';
import {
  Badge,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Modal,
  ModalActions,
  PageHeader,
  borderWidths,
  colors,
  formatDate,
  radii,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function AssistenzaScreen() {
  const router = useRouter();
  const { condominio } = useProfilo();
  const { breakpoint, isDesktop } = useBreakpoint();

  const [dati, setDati] = useState<DatiAssistenza | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);
  const [faqAperta, setFaqAperta] = useState(false);

  const caricaDati = useCallback(async () => {
    if (!condominio?.id) {
      setCaricamento(false);
      return;
    }
    setCaricamento(true);
    setErrore(false);
    try {
      const res = await services.assistenza.caricaDatiAssistenza(condominio.id);
      setDati(res);
    } catch {
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id]);

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  const handleChiama = (numero: string) => {
    const pulito = numero.replace(/\s+/g, '');
    void Linking.openURL(`tel:${pulito}`).catch(() => undefined);
  };

  const handleEmail = (email: string) => {
    void Linking.openURL(`mailto:${email}`).catch(() => undefined);
  };

  const breadcrumbs = [
    { label: 'Home', onPress: () => router.push('/') },
    { label: 'Assistenza' },
  ];

  if (!condominio) {
    return (
      <View style={styles.pagina}>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          title="Assistenza e contatti"
          subtitle="Recapiti dell'amministrazione e numeri di pronto intervento."
        />
        <EmptyState
          icon="circle-help"
          title="Nessun condominio selezionato"
          description="Seleziona un condominio per consultare i contatti dell'amministrazione e i numeri utili."
        />
      </View>
    );
  }

  if (caricamento) {
    return (
      <View style={styles.pagina}>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          title="Assistenza e contatti"
          subtitle="Recapiti dell'amministrazione e numeri di pronto intervento."
        />
        <LoadingState message="Caricamento dei contatti e dei numeri utili in corso…" />
      </View>
    );
  }

  if (errore || !dati) {
    return (
      <View style={styles.pagina}>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          title="Assistenza e contatti"
          subtitle="Recapiti dell'amministrazione e numeri di pronto intervento."
        />
        <ErrorState
          title="Non è stato possibile caricare i contatti di assistenza"
          description="Controlla la connessione e riprova tra qualche istante."
          onRetry={caricaDati}
        />
      </View>
    );
  }

  const { amministrazione, numeriEmergenza, polizza } = dati;

  return (
    <View style={styles.pagina}>
      <Breadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Assistenza e contatti"
        subtitle={`Recapiti dell'amministrazione, numeri utili per urgenze e informazioni di fabbricato per ${condominio.nome}.`}
      />

      {/* Scorciatoie rapide */}
      <View style={[styles.grigliaScorciatoie, isDesktop && styles.grigliaScorciatoieDesktop]}>
        <Card>
          <View style={styles.contenutoScorciatoia}>
            <View style={[styles.iconaScorciatoia, { backgroundColor: colors.tile.blue.background }]}>
              <Icon name="wrench" size="card" color={colors.tile.blue.foreground} />
            </View>
            <Text style={[textStyle('h4', breakpoint), styles.titoloScorciatoia]}>Segnala un guasto</Text>
            <Text style={[textStyle('secondary', breakpoint), styles.descrizioneScorciatoia]}>
              Apri una richiesta di intervento con foto per le parti comuni o per la tua unità.
            </Text>
            <Button
              variant="primary"
              label="Nuova segnalazione"
              icon="wrench"
              onPress={() => router.push('/segnalazioni')}
            />
          </View>
        </Card>

        <Card>
          <View style={styles.contenutoScorciatoia}>
            <View style={[styles.iconaScorciatoia, { backgroundColor: colors.tile.teal.background }]}>
              <Icon name="message-circle" size="card" color={colors.tile.teal.foreground} />
            </View>
            <Text style={[textStyle('h4', breakpoint), styles.titoloScorciatoia]}>I tuoi ticket</Text>
            <Text style={[textStyle('secondary', breakpoint), styles.descrizioneScorciatoia]}>
              Consulta lo stato di avanzamento, le risposte e gli aggiornamenti dei ticket aperti.
            </Text>
            <Button
              variant="secondary"
              label="Visualizza ticket"
              icon="message-circle"
              onPress={() => router.push('/segnalazioni')}
            />
          </View>
        </Card>

        <Card>
          <View style={styles.contenutoScorciatoia}>
            <View style={[styles.iconaScorciatoia, { backgroundColor: colors.tile.navy.background }]}>
              <Icon name="circle-help" size="card" color={colors.tile.navy.foreground} />
            </View>
            <Text style={[textStyle('h4', breakpoint), styles.titoloScorciatoia]}>Guida e FAQ</Text>
            <Text style={[textStyle('secondary', breakpoint), styles.descrizioneScorciatoia]}>
              Risposte alle domande più frequenti su scadenze, assemblee e servizi di stabile.
            </Text>
            <Button
              variant="text"
              label="Consulta guida"
              icon="circle-help"
              onPress={() => setFaqAperta(true)}
            />
          </View>
        </Card>
      </View>

      <View style={[styles.layoutPrincipale, isDesktop && styles.layoutPrincipaleDesktop]}>
        {/* Colonna Sinistra / Principale: Contatti Amministrazione & Numeri Emergenza */}
        <View style={styles.colonnaPrincipale}>
          {/* Scheda Contatti Amministrazione */}
          <Card title="Amministrazione del condominio">
            <View style={styles.bloccoAmministrazione}>
              <View style={styles.rigaIntestazioneStudio}>
                <View style={[styles.cerchioStudio, { backgroundColor: colors.tile.navy.background }]}>
                  <Icon name="building-2" size="card" color={colors.tile.navy.foreground} />
                </View>
                <View style={styles.infoStudio}>
                  <Text style={[textStyle('h4', breakpoint), styles.nomeStudio]}>
                    {amministrazione.nomeStudio}
                  </Text>
                  <Text style={[textStyle('secondary', breakpoint), styles.amministratoreReferente]}>
                    Amministratore referente: {amministrazione.amministratore}
                  </Text>
                  <Text style={[textStyle('secondary', breakpoint), styles.indirizzoStudio]}>
                    {amministrazione.indirizzoStudio}
                  </Text>
                </View>
              </View>

              <View style={styles.dettagliRecapiti}>
                {amministrazione.telefono ? (
                  <View style={styles.rigaRecapito}>
                    <Icon name="phone" size="action" color={colors.text.secondary} />
                    <View style={styles.datiRecapito}>
                      <Text style={[textStyle('secondary', breakpoint), styles.etichettaRecapito]}>Telefono studio</Text>
                      <Text style={[textStyle('body', breakpoint), styles.valoreRecapito]}>
                        {amministrazione.telefono}
                      </Text>
                    </View>
                    <Button
                      variant="secondary"
                      label="Chiama"
                      icon="phone"
                      onPress={() => handleChiama(amministrazione.telefono!)}
                    />
                  </View>
                ) : null}

                {amministrazione.email ? (
                  <View style={styles.rigaRecapito}>
                    <Icon name="mail" size="action" color={colors.text.secondary} />
                    <View style={styles.datiRecapito}>
                      <Text style={[textStyle('secondary', breakpoint), styles.etichettaRecapito]}>Email di contatto</Text>
                      <Text style={[textStyle('body', breakpoint), styles.valoreRecapito]}>
                        {amministrazione.email}
                      </Text>
                    </View>
                    <Button
                      variant="text"
                      label="Scrivi"
                      icon="mail"
                      onPress={() => handleEmail(amministrazione.email!)}
                    />
                  </View>
                ) : null}

                <View style={styles.rigaOrari}>
                  <Icon name="clock" size="action" color={colors.text.secondary} />
                  <View style={styles.datiRecapito}>
                    <Text style={[textStyle('secondary', breakpoint), styles.etichettaRecapito]}>Orari di reperibilità</Text>
                    <Text style={[textStyle('body', breakpoint), styles.valoreRecapito]}>
                      {amministrazione.orariReperibilita}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>

          {/* Scheda Numeri Utili e Pronto Intervento */}
          <Card title="Pronto intervento e numeri utili">
            <View style={styles.bloccoNumeri}>
              <Text style={[textStyle('secondary', breakpoint), styles.descrizioneNumeri]}>
                In caso di guasto urgente alle parti comuni (blocco ascensore, perdite idriche o cancelli bloccati), utilizza i seguenti recapiti dedicati:
              </Text>

              <View style={styles.elencoNumeri}>
                {numeriEmergenza.map((item) => (
                  <View key={item.id} style={styles.cardNumeroEmergenza}>
                    <View style={styles.rigaNumeroSuperiore}>
                      <View style={styles.gruppoTitoloNumero}>
                        <Icon name={item.icona} size="action" color={colors.brand.navy} />
                        <Text style={[textStyle('h4', breakpoint), styles.titoloNumero]}>
                          {item.titolo}
                        </Text>
                      </View>
                      <Badge
                        status={item.categoria === 'emergenza' ? 'scaduto' : item.categoria === 'ascensore' ? 'aperto' : 'in-corso'}
                        label={item.disponibilita}
                      />
                    </View>

                    <Text style={[textStyle('secondary', breakpoint), styles.descrizioneNumero]}>
                      {item.descrizione}
                    </Text>

                    <View style={styles.rigaNumeroInferiore}>
                      <Text style={[textStyle('h3', breakpoint), styles.cifraNumero]}>
                        {item.numero}
                      </Text>
                      <Button
                        variant="secondary"
                        label="Chiama ora"
                        icon="phone"
                        onPress={() => handleChiama(item.numero)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        </View>

        {/* Colonna Destra / Secondaria: Polizza Fabbricato */}
        <View style={styles.colonnaLaterale}>
          <Card title="Assicurazione del fabbricato">
            <View style={styles.bloccoPolizza}>
              <View style={styles.iconaPolizzaCentrata}>
                <View style={[styles.cerchioPolizza, { backgroundColor: colors.tile.blue.background }]}>
                  <Icon name="shield" size="card" color={colors.tile.blue.foreground} />
                </View>
              </View>

              {polizza ? (
                <View style={styles.datiPolizza}>
                  <View style={styles.vocePolizza}>
                    <Text style={[textStyle('secondary', breakpoint), styles.etichettaPolizza]}>Compagnia assicuratrice</Text>
                    <Text style={[textStyle('body', breakpoint), styles.valorePolizza]}>
                      {polizza.compagnia}
                    </Text>
                  </View>

                  <View style={styles.vocePolizza}>
                    <Text style={[textStyle('secondary', breakpoint), styles.etichettaPolizza]}>Numero di polizza</Text>
                    <Text style={[textStyle('body', breakpoint), styles.valorePolizza]}>
                      {polizza.numeroPolizza || 'In corso di definizione'}
                    </Text>
                  </View>

                  <View style={styles.vocePolizza}>
                    <Text style={[textStyle('secondary', breakpoint), styles.etichettaPolizza]}>Scadenza contratto</Text>
                    <Text style={[textStyle('body', breakpoint), styles.valorePolizza]}>
                      {formatDate(polizza.dataScadenza)}
                    </Text>
                  </View>

                  <View style={styles.boxIstruzioniSinistro}>
                    <Text style={[textStyle('secondary', breakpoint), styles.titoloIstruzioni]}>
                      Come procedere in caso di sinistro
                    </Text>
                    <Text style={[textStyle('secondary', breakpoint), styles.testoIstruzioni]}>
                      In caso di infiltrazioni, danni da acqua o eventi che coinvolgano le parti comuni, segnala tempestivamente l'accaduto aprendo un ticket con foto e riferisci il numero di polizza qui riportato.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.datiPolizzaVuoti}>
                  <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                    Gli estremi della polizza globale fabbricati per questo condominio sono in fase di aggiornamento da parte dello studio di amministrazione.
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </View>
      </View>

      {/* Modale FAQ e Domande Frequenti */}
      <Modal
        visible={faqAperta}
        title="Guida rapida e domande frequenti"
        onClose={() => setFaqAperta(false)}
      >
        <View style={styles.bloccoFaq}>
          <View style={styles.itemFaq}>
            <Text style={[textStyle('h4', breakpoint), styles.domandaFaq]}>
              1. Come posso segnalare un guasto urgente?
            </Text>
            <Text style={[textStyle('body', breakpoint), styles.rispostaFaq]}>
              Puoi premere il pulsante "Nuova segnalazione" in alto o andare nella sezione "Segnalazioni". Per urgenze che richiedono un pronto intervento immediato (come fughe d'acqua o cancelli bloccati), usa direttamente i numeri telefonici di reperibilità riportati in questa pagina.
            </Text>
          </View>

          <View style={styles.itemFaq}>
            <Text style={[textStyle('h4', breakpoint), styles.domandaFaq]}>
              2. Dove posso trovare le rate e verificare i pagamenti?
            </Text>
            <Text style={[textStyle('body', breakpoint), styles.rispostaFaq]}>
              Nella sezione "Pagamenti" trovi il riepilogo di tutte le rate condominiali dell'esercizio, la data di scadenza, le coordinate bancarie per il bonifico e lo stato di saldo aggiornato dall'amministrazione.
            </Text>
          </View>

          <View style={styles.itemFaq}>
            <Text style={[textStyle('h4', breakpoint), styles.domandaFaq]}>
              3. Come partecipo a un'assemblea online o consulto il verbale?
            </Text>
            <Text style={[textStyle('body', breakpoint), styles.rispostaFaq]}>
              Nella sezione "Assemblee" trovi l'elenco delle riunioni convocate con l'ordine del giorno. Quando l'assemblea è in corso puoi partecipare al collegamento video e votare sui singoli punti. A conclusione dell'assemblea, puoi scaricare il verbale approvato in formato PDF protetto.
            </Text>
          </View>

          <View style={styles.itemFaq}>
            <Text style={[textStyle('h4', breakpoint), styles.domandaFaq]}>
              4. Cosa fare in caso di blocco dell'ascensore con persone all'interno?
            </Text>
            <Text style={[textStyle('body', breakpoint), styles.rispostaFaq]}>
              Contatta subito il numero verde H24 del pronto intervento ascensori indicato in questa schermata. Rassicura le persone in cabina e non tentare mai manovre di sblocco manuale fai-da-te.
            </Text>
          </View>
        </View>

        <ModalActions>
          <Button
            variant="secondary"
            label="Chiudi guida"
            onPress={() => setFaqAperta(false)}
          />
        </ModalActions>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    alignSelf: 'stretch',
    gap: space[6],
  },
  grigliaScorciatoie: {
    gap: space[4],
  },
  grigliaScorciatoieDesktop: {
    flexDirection: 'row',
  },
  contenutoScorciatoia: {
    flex: 1,
    gap: space[3],
    alignItems: 'flex-start',
  },
  iconaScorciatoia: {
    width: 44,
    height: 44,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titoloScorciatoia: {
    color: colors.text.primary,
  },
  descrizioneScorciatoia: {
    color: colors.text.secondary,
    flex: 1,
  },
  layoutPrincipale: {
    gap: space[6],
  },
  layoutPrincipaleDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colonnaPrincipale: {
    flex: 2,
    gap: space[6],
  },
  colonnaLaterale: {
    flex: 1,
    minWidth: 280,
    gap: space[6],
  },
  bloccoAmministrazione: {
    gap: space[5],
  },
  rigaIntestazioneStudio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingBottom: space[4],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  cerchioStudio: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStudio: {
    flex: 1,
    gap: space[1],
  },
  nomeStudio: {
    color: colors.text.primary,
  },
  amministratoreReferente: {
    color: colors.text.secondary,
  },
  indirizzoStudio: {
    color: colors.text.muted,
  },
  dettagliRecapiti: {
    gap: space[4],
  },
  rigaRecapito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  rigaOrari: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingTop: space[2],
  },
  datiRecapito: {
    flex: 1,
  },
  etichettaRecapito: {
    color: colors.text.muted,
    fontSize: 13,
  },
  valoreRecapito: {
    color: colors.text.primary,
  },
  bloccoNumeri: {
    gap: space[4],
  },
  descrizioneNumeri: {
    color: colors.text.secondary,
  },
  elencoNumeri: {
    gap: space[3],
  },
  cardNumeroEmergenza: {
    padding: space[4],
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[2],
  },
  rigaNumeroSuperiore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[2],
  },
  gruppoTitoloNumero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
    minWidth: 180,
  },
  titoloNumero: {
    color: colors.text.primary,
  },
  descrizioneNumero: {
    color: colors.text.secondary,
  },
  rigaNumeroInferiore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  cifraNumero: {
    color: colors.brand.navy,
  },
  bloccoPolizza: {
    gap: space[4],
  },
  iconaPolizzaCentrata: {
    alignItems: 'center',
    marginBottom: space[2],
  },
  cerchioPolizza: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datiPolizza: {
    gap: space[3],
  },
  datiPolizzaVuoti: {
    padding: space[2],
  },
  vocePolizza: {
    gap: space[1],
  },
  etichettaPolizza: {
    color: colors.text.muted,
    fontSize: 13,
  },
  valorePolizza: {
    color: colors.text.primary,
  },
  boxIstruzioniSinistro: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[1],
  },
  titoloIstruzioni: {
    color: colors.text.primary,
    fontSize: 13,
  },
  testoIstruzioni: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  testoSecondario: {
    color: colors.text.secondary,
  },
  bloccoFaq: {
    gap: space[4],
    maxHeight: 480,
  },
  itemFaq: {
    gap: space[1],
    paddingBottom: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  domandaFaq: {
    color: colors.text.primary,
  },
  rispostaFaq: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
