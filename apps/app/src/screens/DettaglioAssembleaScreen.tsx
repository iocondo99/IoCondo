import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  badgeStatoAssemblea,
  etichettaModalitaAssemblea,
  etichettaSceltaVoto,
  etichettaStatoAssemblea,
  etichettaTipoAssemblea,
  MESSAGGIO_VERBALE_NON_DISPONIBILE,
  type DettaglioAssembleaCondomino,
  type PuntoOdgDettaglio,
  type RisultatoOpzioneVoto,
  type VotoScelta,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  NonAutorizzato,
  PageHeader,
  Skeleton,
  SkeletonText,
  borderWidths,
  colors,
  formatDate,
  radii,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

function formatOrario(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}

/**
 * Schermata di dettaglio assemblea per il condòmino (`/assemblee/[id]`, UC-10):
 * - Breadcrumbs e PageHeader con titolo assemblea e stato;
 * - Card riepilogo con data, orario, luogo, modalità, eventuale link Meet verificato e verbale;
 * - Elenco interattivo dei punti ODG con votazione nominale del residente e risultati aggregati
 *   calcolati tramite la RPC `risultati_voto` (zero voti dei singoli vicini);
 * - Stato NonAutorizzato uniforme per bozze, assemblee di altri condomini o ID non validi.
 */
export function DettaglioAssembleaScreen() {
  const consentito = useAccessoConsentito();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profilo, condominio, voci } = useProfilo();
  const router = useRouter();

  if (!consentito || !profilo || !condominio) return null;

  const abilitata = voci.some((v) => v.id === 'assemblee');
  if (!abilitata || !id) {
    return <AssembleaNonDisponibile onTorna={() => router.replace('/assemblee' as Href)} />;
  }

  return (
    <DettaglioAssembleaContenuto
      assembleaId={id}
      utenteId={profilo.id}
      condominioId={condominio.id}
    />
  );
}

function AssembleaNonDisponibile({ onTorna }: { onTorna: () => void }) {
  return (
    <NonAutorizzato
      title="Questa assemblea non è disponibile"
      description="Non puoi consultare questa assemblea. Torna all’elenco per visualizzare le assemblee del tuo condominio."
      action={{ label: 'Torna alle assemblee', icon: 'users', onPress: onTorna }}
    />
  );
}

function DettaglioAssembleaContenuto({
  assembleaId,
  utenteId,
  condominioId,
}: {
  assembleaId: string;
  utenteId: string;
  condominioId: string;
}) {
  const router = useRouter();
  const { breakpoint } = useBreakpoint();
  const chiave = `${assembleaId}|${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.assemblee.dettaglioAssembleaCondomino(utenteId, condominioId, assembleaId),
    chiave,
  );

  const primoFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primoFocus.current) {
        primoFocus.current = false;
        return;
      }
      ricarica();
    }, [ricarica]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (stato: AppStateStatus) => {
      if (stato === 'active') ricarica();
    });
    return () => sub.remove();
  }, [ricarica]);

  const indietro = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/assemblee' as Href);
    }
  }, [router]);

  const [invioVotoPuntoId, setInvioVotoPuntoId] = useState<string | null>(null);
  const [messaggioConferma, setMessaggioConferma] = useState<string | null>(null);
  const [erroreVoto, setErroreVoto] = useState<string | null>(null);

  const assemblea: DettaglioAssembleaCondomino | null =
    blocco.stato === 'pronto' ? blocco.dati : null;

  const inviaVoto = useCallback(
    async (puntoId: string, unitaId: string, scelta: VotoScelta) => {
      try {
        setInvioVotoPuntoId(puntoId);
        setErroreVoto(null);
        setMessaggioConferma(null);

        await services.assemblee.esprimiVoto(utenteId, puntoId, unitaId, scelta);

        setMessaggioConferma(`Voto registrato con successo: ${etichettaSceltaVoto(scelta)}`);
        ricarica();
      } catch (err: any) {
        setErroreVoto(err?.message || 'Non è stato possibile registrare il voto. Riprova.');
      } finally {
        setInvioVotoPuntoId(null);
      }
    },
    [utenteId, ricarica],
  );

  if (blocco.stato === 'caricamento') {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Caricamento assemblea..." onBack={indietro} />
        <Card>
          <View style={styles.schedaCaricamento}>
            <Skeleton shape="block" height={space[8]} width="40%" />
            <SkeletonText lines={4} />
          </View>
        </Card>
      </View>
    );
  }

  if (blocco.stato === 'errore') {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Assemblea" onBack={indietro} />
        <Card>
          <ErrorState
            title="Non è stato possibile caricare l’assemblea"
            description="Si è verificato un errore durante il caricamento dei dettagli dell’assemblea."
            onRetry={ricarica}
          />
        </Card>
      </View>
    );
  }

  // Se null -> NonAutorizzato (identico per bozza, altro condominio o inesistente)
  if (!assemblea) {
    return <AssembleaNonDisponibile onTorna={indietro} />;
  }

  const breadcrumbs = [
    { label: 'Home', onPress: () => router.navigate('/home' as Href) },
    { label: 'Assemblee', onPress: () => router.navigate('/assemblee' as Href) },
    { label: `Assemblea del ${formatDate(assemblea.data)}` },
  ];

  const orario = formatOrario(assemblea.data);
  const dataCompleta = orario ? `${formatDate(assemblea.data)}, ore ${orario}` : formatDate(assemblea.data);

  return (
    <View style={styles.pagina}>
      <PageHeader
        title={`${etichettaTipoAssemblea(assemblea.tipo)} — Assemblea`}
        subtitle={dataCompleta}
        breadcrumbs={breadcrumbs}
        onBack={indietro}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica }}
      />

      {messaggioConferma ? (
        <Alert
          tone="success"
          message={messaggioConferma}
          onDismiss={() => setMessaggioConferma(null)}
        />
      ) : null}

      {erroreVoto ? (
        <Alert tone="error" message={erroreVoto} onDismiss={() => setErroreVoto(null)} />
      ) : null}

      {/* Card Riepilogo Assemblea */}
      <Card>
        <View style={styles.intestazioneScheda}>
          <Text accessibilityRole="header" aria-level={2} style={[textStyle('h3', breakpoint), styles.titoloForte]}>
            Riepilogo assemblea
          </Text>
          <Badge
            status={badgeStatoAssemblea(assemblea.stato)}
            label={etichettaStatoAssemblea(assemblea.stato)}
          />
        </View>

        <View style={styles.grigliaDettagli}>
          <View style={styles.rigaDettaglio}>
            <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>Data e orario</Text>
            <Text style={[textStyle('body', breakpoint), styles.testoForte]}>{dataCompleta}</Text>
          </View>

          <View style={styles.rigaDettaglio}>
            <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>Tipologia</Text>
            <Text style={[textStyle('body', breakpoint), styles.testoForte]}>
              {etichettaTipoAssemblea(assemblea.tipo)}
            </Text>
          </View>

          <View style={styles.rigaDettaglio}>
            <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>Modalità di svolgimento</Text>
            <Text style={[textStyle('body', breakpoint), styles.testoForte]}>
              {etichettaModalitaAssemblea(assemblea.modalita)}
            </Text>
          </View>

          {assemblea.luogo ? (
            <View style={styles.rigaDettaglio}>
              <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>Luogo</Text>
              <Text style={[textStyle('body', breakpoint), styles.testoForte]}>{assemblea.luogo}</Text>
            </View>
          ) : null}
        </View>

        {/* Collegamento Video-Call se presente e valido */}
        {assemblea.linkMeetValido ? (
          <View style={styles.sezioneMeet}>
            <View style={styles.infoMeet}>
              <Icon name="users" size="action" color={colors.action.default} />
              <View style={styles.testoMeet}>
                <Text style={[textStyle('body', breakpoint), styles.testoForte]}>
                  Riunione online disponibile
                </Text>
                <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                  L’assemblea si svolge anche tramite collegamento telematico protetto.
                </Text>
              </View>
            </View>
            <Button
              label="Partecipa alla riunione online"
              variant="primary"
              onPress={() => Linking.openURL(assemblea.linkMeetValido!)}
              accessibilityHint="Apre il link alla riunione online nel browser o applicazione di videoconferenza"
            />
          </View>
        ) : null}

        {/* Sezione Verbale */}
        <View style={styles.sezioneVerbale}>
          <Text style={[textStyle('label', breakpoint), styles.testoForte]}>Verbale dell’assemblea</Text>
          {assemblea.verbaleDisponibile && assemblea.verbaleUrlFirmato ? (
            <View style={styles.azioneVerbale}>
              <Text style={[textStyle('body', breakpoint), styles.testoPrimario]}>
                Il verbale ufficiale è disponibile per il download.
              </Text>
              <Button
                label="Scarica verbale"
                icon="file-text"
                variant="secondary"
                onPress={() => Linking.openURL(assemblea.verbaleUrlFirmato!)}
                accessibilityHint="Scarica il documento PDF del verbale ufficiale dell'assemblea"
              />
            </View>
          ) : assemblea.verbaleUrl ? (
            <Alert
              tone="info"
              message={MESSAGGIO_VERBALE_NON_DISPONIBILE}
            />
          ) : (
            <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>
              {assemblea.stato === 'CONCLUSA'
                ? 'Il verbale non è ancora stato caricato dall’amministrazione.'
                : 'Il verbale sarà disponibile al termine dell’assemblea.'}
            </Text>
          )}
        </View>
      </Card>

      {/* Punti all'ordine del giorno */}
      <View style={styles.sezioneOdg}>
        <View style={styles.intestazioneSezione}>
          <Text accessibilityRole="header" aria-level={2} style={[textStyle('h2', breakpoint), styles.titoloForte]}>
            Ordine del giorno
          </Text>
          <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
            {assemblea.puntiOdg.length === 1
              ? '1 punto da discutere'
              : `${assemblea.puntiOdg.length} punti da discutere e votare`}
          </Text>
        </View>

        {assemblea.puntiOdg.length === 0 ? (
          <Card>
            <View style={styles.schedaVuota}>
              <Text style={[textStyle('body', breakpoint), styles.testoSecondario]}>
                Nessun punto all’ordine del giorno inserito per questa assemblea.
              </Text>
            </View>
          </Card>
        ) : (
          assemblea.puntiOdg.map((punto) => (
            <CardPuntoOdg
              key={punto.id}
              punto={punto}
              assembleaStato={assemblea.stato}
              unitaDisponibili={assemblea.unitaDisponibili}
              invioInCorso={invioVotoPuntoId === punto.id}
              onVota={(unitaId, scelta) => inviaVoto(punto.id, unitaId, scelta)}
            />
          ))
        )}
      </View>
    </View>
  );
}

interface CardPuntoOdgProps {
  punto: PuntoOdgDettaglio;
  assembleaStato: string;
  unitaDisponibili: Array<{ id: string; interno: string }>;
  invioInCorso: boolean;
  onVota: (unitaId: string, scelta: VotoScelta) => void;
}

function CardPuntoOdg({
  punto,
  assembleaStato,
  unitaDisponibili,
  invioInCorso,
  onVota,
}: CardPuntoOdgProps) {
  const { breakpoint } = useBreakpoint();
  const unitaPredefinita = punto.unitaIdVoto || unitaDisponibili[0]?.id || '';
  const [unitaScelta, setUnitaScelta] = useState<string>(unitaPredefinita);

  useEffect(() => {
    if (unitaPredefinita && !unitaScelta) {
      setUnitaScelta(unitaPredefinita);
    }
  }, [unitaPredefinita, unitaScelta]);

  return (
    <Card>
      <View style={styles.intestazionePunto}>
        <View style={styles.titoloPuntoContenitore}>
          <View style={styles.numeroOrdineBadge}>
            <Text style={[textStyle('body', breakpoint), styles.numeroOrdineTesto]}>{punto.ordine}</Text>
          </View>
          <Text
            accessibilityRole="header"
            aria-level={3}
            style={[textStyle('h3', breakpoint), styles.titoloPunto]}
          >
            {punto.titoloPunto}
          </Text>
        </View>
        <Badge
          status={punto.votazioneAperta ? 'votazione-aperta' : 'votazione-chiusa'}
          label={punto.votazioneAperta ? 'Votazione aperta' : 'Votazione chiusa'}
        />
      </View>

      {punto.descrizione ? (
        <Text style={[textStyle('body', breakpoint), styles.testoSecondario, styles.descrizionePunto]}>
          {punto.descrizione}
        </Text>
      ) : null}

      {/* Box votazione residente */}
      <View style={styles.boxVotazione}>
        <View style={styles.intestazioneVotazione}>
          <Text style={[textStyle('label', breakpoint), styles.testoForte]}>Il tuo voto</Text>
          {punto.mioVoto ? (
            <Badge
              status={
                punto.mioVoto === 'FAVOREVOLE'
                  ? 'accettato'
                  : punto.mioVoto === 'CONTRARIO'
                    ? 'scaduto'
                    : 'in-attesa'
              }
              label={`Espresso: ${etichettaSceltaVoto(punto.mioVoto)}`}
            />
          ) : (
            <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>Nessun voto espresso</Text>
          )}
        </View>

        {/* Pulsanti per esprimere o modificare il proprio voto */}
        {punto.votabile ? (
          <View style={styles.controlliVoto}>
            <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
              {punto.mioVoto
                ? 'Puoi modificare il tuo voto finché la votazione resta aperta:'
                : 'Seleziona la tua preferenza di voto per questo punto:'}
            </Text>

            {unitaDisponibili.length > 1 ? (
              <View style={styles.selettoreUnita}>
                <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>Vota per l’unità:</Text>
                <View style={styles.unitaPillole}>
                  {unitaDisponibili.map((u) => {
                    const selezionata = unitaScelta === u.id;
                    return (
                      <Button
                        key={u.id}
                        label={`Int. ${u.interno}`}
                        variant={selezionata ? 'primary' : 'secondary'}
                        onPress={() => setUnitaScelta(u.id)}
                        disabled={invioInCorso}
                      />
                    );
                  })}
                </View>
              </View>
            ) : unitaDisponibili.length === 1 ? (
              <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>
                Unità votante: Interno {unitaDisponibili[0]?.interno}
              </Text>
            ) : null}

            <View style={styles.pulsantiVoto}>
              {(['FAVOREVOLE', 'CONTRARIO', 'ASTENUTO'] as const).map((scelta) => {
                const attivo = punto.mioVoto === scelta;
                return (
                  <View key={scelta} style={styles.pulsanteVotoWrapper}>
                    <Button
                      label={etichettaSceltaVoto(scelta)}
                      variant={attivo ? 'primary' : 'secondary'}
                      loading={invioInCorso}
                      disabled={invioInCorso}
                      onPress={() => onVota(unitaScelta, scelta)}
                      accessibilityHint={`Esprimi voto ${etichettaSceltaVoto(scelta)} per il punto ${punto.ordine}`}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>
            {assembleaStato === 'CONCLUSA'
              ? 'L’assemblea è conclusa e le votazioni sono chiuse.'
              : 'La votazione per questo punto è attualmente chiusa dall’amministrazione.'}
          </Text>
        )}
      </View>

      {/* Visualizzazione aggregata risultati */}
      <View style={styles.sezioneRisultati}>
        <View style={styles.intestazioneRisultati}>
          <Text style={[textStyle('label', breakpoint), styles.testoForte]}>
            Risultati complessivi dell’assemblea
          </Text>
          <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>
            {punto.risultati.haVoti
              ? `${punto.risultati.totaleVoti} teste • ${punto.risultati.totaleMillesimi} millesimi`
              : 'Nessun voto registrato'}
          </Text>
        </View>

        {punto.risultati.haVoti ? (
          <View style={styles.listaRisultati}>
            {punto.risultati.opzioni.map((opz) => (
              <RigaRisultatoVoto key={opz.voto} opzione={opz} />
            ))}
          </View>
        ) : (
          <Text style={[textStyle('support', breakpoint), styles.testoMuted]}>
            I risultati aggregati compariranno non appena verranno espressi i voti.
          </Text>
        )}
      </View>
    </Card>
  );
}

function RigaRisultatoVoto({ opzione }: { opzione: RisultatoOpzioneVoto }) {
  const { breakpoint } = useBreakpoint();
  const colore =
    opzione.voto === 'FAVOREVOLE'
      ? colors.semantic.success.foreground
      : opzione.voto === 'CONTRARIO'
        ? colors.semantic.error.foreground
        : colors.text.muted;

  const pctTeste = Math.min(100, Math.max(0, opzione.percentualeTeste));

  return (
    <View style={styles.rigaRisultato}>
      <View style={styles.etichetteRisultato}>
        <Text style={[textStyle('body', breakpoint), styles.testoForte, { color: colore }]}>
          {opzione.etichetta}
        </Text>
        <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
          {opzione.percentualeTeste}% teste ({opzione.nVoti} {opzione.nVoti === 1 ? 'voto' : 'voti'}) •{' '}
          {opzione.percentualeMillesimi}% millesimi ({opzione.millesimi} mill.)
        </Text>
      </View>

      {/* Barra di avanzamento teste */}
      <View
        style={styles.barraSfondo}
        accessible
        accessibilityLabel={`${opzione.etichetta}: ${opzione.percentualeTeste} percento teste`}
      >
        <View
          style={[
            styles.barraRiempimento,
            { width: `${pctTeste}%`, backgroundColor: colore },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    alignSelf: 'stretch',
    gap: space[6],
  },
  schedaCaricamento: {
    gap: space[3],
  },
  intestazioneScheda: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  grigliaDettagli: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  rigaDettaglio: {
    flexGrow: 1,
    flexBasis: 200,
    gap: space[1],
  },
  sezioneMeet: {
    backgroundColor: colors.tile.blue.background,
    borderRadius: radii.card,
    padding: space[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[3],
  },
  infoMeet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
    minWidth: 240,
  },
  testoMeet: {
    gap: space[1],
    flex: 1,
  },
  sezioneVerbale: {
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    paddingTop: space[4],
    gap: space[2],
  },
  azioneVerbale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[3],
  },
  sezioneOdg: {
    gap: space[4],
  },
  intestazioneSezione: {
    gap: space[1],
  },
  schedaVuota: {
    alignItems: 'center',
  },
  intestazionePunto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: space[2],
  },
  titoloPuntoContenitore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
    minWidth: 240,
  },
  numeroOrdineBadge: {
    width: space[6],
    height: space[6],
    borderRadius: radii.full,
    backgroundColor: colors.tile.navy.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numeroOrdineTesto: {
    fontWeight: '700',
    color: colors.brand.navy,
  },
  titoloPunto: {
    flex: 1,
    color: colors.brand.navy,
  },
  descrizionePunto: {
    paddingLeft: space[8],
  },
  boxVotazione: {
    backgroundColor: colors.background,
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    padding: space[4],
    gap: space[3],
  },
  intestazioneVotazione: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  controlliVoto: {
    gap: space[3],
  },
  selettoreUnita: {
    gap: space[2],
  },
  unitaPillole: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  pulsantiVoto: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  pulsanteVotoWrapper: {
    flexGrow: 1,
    flexBasis: 140,
  },
  sezioneRisultati: {
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    paddingTop: space[4],
    gap: space[3],
  },
  intestazioneRisultati: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  listaRisultati: {
    gap: space[3],
  },
  rigaRisultato: {
    gap: space[1],
  },
  etichetteRisultato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  barraSfondo: {
    height: space[2],
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
    width: '100%',
  },
  barraRiempimento: {
    height: '100%',
    borderRadius: radii.full,
  },
  titoloForte: {
    color: colors.brand.navy,
    fontWeight: '600',
  },
  testoPrimario: {
    color: colors.text.primary,
  },
  testoForte: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  testoSecondario: {
    color: colors.text.secondary,
  },
  testoMuted: {
    color: colors.text.muted,
  },
});
