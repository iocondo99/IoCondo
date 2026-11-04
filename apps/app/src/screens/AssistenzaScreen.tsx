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
  radii,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const FAQ_ITEMS = [
  {
    id: 'guasti',
    domanda: '1. Come posso segnalare un guasto urgente?',
    risposta:
      'In caso di guasto urgente alle parti comuni (blocco ascensore, perdite idriche o cancelli bloccati), utilizza direttamente i recapiti di reperibilità telefonica riportati in questa pagina. Per tutte le altre richieste puoi aprire un ticket con foto nella sezione Segnalazioni.',
  },
  {
    id: 'rate',
    domanda: '2. Dove posso trovare le rate e verificare i pagamenti?',
    risposta:
      'Nella sezione Pagamenti trovi il riepilogo di tutte le rate condominiali dell’esercizio, la data di scadenza, le coordinate bancarie per il bonifico e lo stato di saldo aggiornato dall’amministrazione.',
  },
  {
    id: 'assemblee',
    domanda: '3. Come partecipo a un’assemblea online o consulto il verbale?',
    risposta:
      'Nella sezione Assemblee trovi l’elenco delle riunioni convocate con l’ordine del giorno. Quando l’assemblea è in corso puoi partecipare al collegamento video e votare sui singoli punti. A conclusione dell’assemblea, puoi scaricare il verbale approvato in formato PDF protetto.',
  },
  {
    id: 'ascensore',
    domanda: '4. Cosa fare in caso di blocco dell’ascensore con persone all’interno?',
    risposta:
      'Contatta subito il numero verde H24 del pronto intervento ascensori indicato in questa schermata. Rassicura le persone in cabina e non tentare mai manovre di sblocco manuale fai-da-te.',
  },
];

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
    const pulito = email.trim();
    void Linking.openURL(`mailto:${pulito}`).catch(() => undefined);
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

  const { amministrazione, numeriEmergenza } = dati;

  return (
    <View style={styles.pagina}>
      <Breadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Assistenza e contatti"
        subtitle={`Recapiti dell'amministrazione, numeri utili per urgenze e supporto per ${condominio.nome}.`}
      />

      {/* 1. Amministrazione del condominio a tutta larghezza */}
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
                  <Text style={[textStyle('secondary', breakpoint), styles.etichettaRecapito]}>
                    Telefono studio
                  </Text>
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
                  <Text style={[textStyle('secondary', breakpoint), styles.etichettaRecapito]}>
                    Email di contatto
                  </Text>
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
                <Text style={[textStyle('secondary', breakpoint), styles.etichettaRecapito]}>
                  Orari di reperibilità
                </Text>
                <Text style={[textStyle('body', breakpoint), styles.valoreRecapito]}>
                  {amministrazione.orariReperibilita}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Card>

      {/* 2. Guida e FAQ a tutta larghezza */}
      <Card title="Guida e FAQ">
        <View style={styles.bloccoGuidaFaq}>
          <View style={styles.rigaIntestazioneStudio}>
            <View style={[styles.cerchioStudio, { backgroundColor: colors.tile.blue.background }]}>
              <Icon name="circle-help" size="card" color={colors.tile.blue.foreground} />
            </View>
            <View style={styles.infoStudio}>
              <Text style={[textStyle('h4', breakpoint), styles.nomeStudio]}>
                Domande frequenti
              </Text>
              <Text style={[textStyle('secondary', breakpoint), styles.descrizioneFaqCard]}>
                Risposte rapide ai dubbi più comuni su gestione del condominio, rate e servizi.
              </Text>
            </View>
          </View>

          <View style={[styles.elencoFaqAnteprima, isDesktop && styles.elencoFaqAnteprimaDesktop]}>
            {FAQ_ITEMS.map((item) => (
              <View
                key={item.id}
                style={[styles.itemFaqAnteprima, isDesktop && styles.itemFaqAnteprimaDesktop]}
              >
                <Text style={[textStyle('label', breakpoint), styles.domandaAnteprima]}>
                  {item.domanda}
                </Text>
                <Text
                  style={[textStyle('secondary', breakpoint), styles.rispostaAnteprima]}
                  numberOfLines={2}
                >
                  {item.risposta}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.bloccoAzioneFaq}>
            <Button
              variant="secondary"
              label="Consulta guida completa"
              icon="circle-help"
              onPress={() => setFaqAperta(true)}
            />
          </View>
        </View>
      </Card>

      {/* Sezione Inferiore: Pronto intervento e numeri utili a tutta larghezza */}
      <Card title="Pronto intervento e numeri utili">
        <View style={styles.bloccoNumeri}>
          <Text style={[textStyle('secondary', breakpoint), styles.descrizioneNumeri]}>
            In caso di guasto urgente alle parti comuni (blocco ascensore, perdite idriche o cancelli bloccati), utilizza i seguenti recapiti dedicati:
          </Text>

          <View style={[styles.elencoNumeri, isDesktop && styles.elencoNumeriDesktop]}>
            {numeriEmergenza.map((item) => (
              <View
                key={item.id}
                style={[styles.cardNumeroEmergenza, isDesktop && styles.cardNumeroEmergenzaDesktop]}
              >
                <View style={styles.rigaNumeroSuperiore}>
                  <View style={styles.gruppoTitoloNumero}>
                    <Icon name={item.icona} size="action" color={colors.brand.navy} />
                    <Text style={[textStyle('h4', breakpoint), styles.titoloNumero]}>
                      {item.titolo}
                    </Text>
                  </View>
                  <Badge
                    status={
                      item.categoria === 'emergenza'
                        ? 'scaduto'
                        : item.categoria === 'ascensore'
                          ? 'aperto'
                          : 'in-corso'
                    }
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

      {/* Modale FAQ Completa */}
      <Modal
        visible={faqAperta}
        title="Guida rapida e domande frequenti"
        onClose={() => setFaqAperta(false)}
      >
        <View style={styles.bloccoFaq}>
          {FAQ_ITEMS.map((item) => (
            <View key={item.id} style={styles.itemFaq}>
              <Text style={[textStyle('h4', breakpoint), styles.domandaFaq]}>
                {item.domanda}
              </Text>
              <Text style={[textStyle('body', breakpoint), styles.rispostaFaq]}>
                {item.risposta}
              </Text>
            </View>
          ))}
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
  bloccoAmministrazione: {
    gap: space[4],
  },
  bloccoGuidaFaq: {
    gap: space[4],
  },
  rigaIntestazioneStudio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  cerchioStudio: {
    width: 48,
    height: 48,
    borderRadius: radii.control,
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
  descrizioneFaqCard: {
    color: colors.text.secondary,
  },
  dettagliRecapiti: {
    gap: space[3],
    paddingTop: space[3],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  rigaRecapito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  rigaOrari: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  datiRecapito: {
    flex: 1,
  },
  etichettaRecapito: {
    color: colors.text.muted,
  },
  valoreRecapito: {
    color: colors.text.primary,
  },
  elencoFaqAnteprima: {
    gap: space[3],
    paddingTop: space[3],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  elencoFaqAnteprimaDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  itemFaqAnteprima: {
    gap: space[1],
  },
  itemFaqAnteprimaDesktop: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  domandaAnteprima: {
    color: colors.text.primary,
  },
  rispostaAnteprima: {
    color: colors.text.secondary,
  },
  bloccoAzioneFaq: {
    paddingTop: space[2],
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bloccoNumeri: {
    gap: space[4],
  },
  descrizioneNumeri: {
    color: colors.text.secondary,
  },
  elencoNumeri: {
    gap: space[4],
  },
  elencoNumeriDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardNumeroEmergenza: {
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: space[3],
  },
  cardNumeroEmergenzaDesktop: {
    flex: 1,
    minWidth: 380,
  },
  rigaNumeroSuperiore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    flexWrap: 'wrap',
  },
  gruppoTitoloNumero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
  },
  titoloNumero: {
    color: colors.brand.navy,
  },
  descrizioneNumero: {
    color: colors.text.secondary,
  },
  rigaNumeroInferiore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingTop: space[2],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  cifraNumero: {
    color: colors.text.primary,
  },
  bloccoFaq: {
    gap: space[4],
  },
  itemFaq: {
    gap: space[2],
    paddingBottom: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  domandaFaq: {
    color: colors.brand.navy,
  },
  rispostaFaq: {
    color: colors.text.primary,
  },
});
