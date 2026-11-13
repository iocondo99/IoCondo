import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  FEATURE_PIANO_UNICO,
  formattaDataItaliana,
  formattaEuroSaas,
  validaPianoUnico,
  type PianoUnicoView,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  PageHeader,
  Textarea,
  colors,
  radii,
  space,
  textStyle,
  useToast,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function SuperAdminPianiScreen() {
  const consentito = useAccessoConsentito();
  const { profilo } = useProfilo();
  if (!consentito || !profilo) return null;
  return <SuperAdminPianiContenuto />;
}

function SuperAdminPianiContenuto() {
  const toast = useToast();
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [piano, setPiano] = useState<PianoUnicoView | null>(null);

  // Modale modifica canone
  const [modaleAperta, setModaleAperta] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [prezzoInput, setPrezzoInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [erroriForm, setErroriForm] = useState<{ nome?: string; prezzoMensile?: string }>({});
  const [salvataggio, setSalvataggio] = useState(false);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const p = await services.superadmin.getPianoUnico();
      setPiano(p);
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Errore nel caricamento del piano di abbonamento.');
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const apriModifica = () => {
    if (!piano) return;
    setNomeInput(piano.nome);
    setPrezzoInput(String(piano.prezzoMensile).replace('.', ','));
    setNoteInput(piano.note);
    setErroriForm({});
    setModaleAperta(true);
  };

  const salvaModifiche = async () => {
    if (!piano) return;
    const errori = validaPianoUnico(prezzoInput, nomeInput);
    if (errori) {
      setErroriForm(errori);
      return;
    }
    setErroriForm({});
    setSalvataggio(true);
    try {
      const prezzoNum = Number(prezzoInput.replace(',', '.').trim());
      const aggiornato = await services.superadmin.aggiornaPianoUnico({
        id: piano.id,
        nome: nomeInput,
        prezzoMensile: prezzoNum,
        note: noteInput,
      });
      setPiano(aggiornato);
      setModaleAperta(false);
      toast.show({ tone: 'success', message: 'Piano di abbonamento aggiornato.' });
    } catch (e: unknown) {
      toast.show({
        tone: 'error',
        message: e instanceof Error ? e.message : 'Impossibile aggiornare il piano.',
      });
    } finally {
      setSalvataggio(false);
    }
  };

  if (caricamento) {
    return <LoadingState message="Caricamento piano di abbonamento…" />;
  }

  if (errore || !piano) {
    return (
      <ErrorState
        title="Impossibile caricare il piano di abbonamento"
        description={errore ?? 'Dati non disponibili.'}
        onRetry={carica}
      />
    );
  }

  return (
    <View style={styles.root}>
      <PageHeader
        title="Piano di Abbonamento Unico"
        subtitle="Configurazione del canone SaaS e delle funzionalità incluse per tutti gli amministratori."
        action={{
          label: 'Modifica canone',
          icon: 'pencil',
          onPress: apriModifica,
        }}
      />

      <Alert
        tone="info"
        title="Modello SaaS a canone unico"
        message="La piattaforma adotta un unico piano all-inclusive senza limiti di unità o blocchi per fascia: tutti gli amministratori accreditati hanno accesso completo ai moduli operativi."
      />

      <Card>
        <View style={styles.pianoHeader}>
          <View style={styles.pianoTitoloBox}>
            <View style={styles.titoloConBadge}>
              <Text style={[textStyle('h2'), styles.titolo]}>{piano.nome}</Text>
              <Badge status="success" label="Piano Attivo" />
            </View>
            <Text style={[textStyle('secondary'), styles.sottotitolo]}>{piano.note}</Text>
          </View>
          <View style={styles.prezzoBox}>
            <Text style={[textStyle('h1'), styles.prezzo]}>
              {formattaEuroSaas(piano.prezzoMensile)}
            </Text>
            <Text style={[textStyle('label'), styles.periodo]}>al mese / licenza</Text>
          </View>
        </View>

        <View style={styles.separatore} />

        <View style={styles.sezioneFeatures}>
          <Text style={[textStyle('h3'), styles.sezioneTitolo]}>
            Funzionalità incluse nel piano
          </Text>
          <View style={styles.grigliaFeatures}>
            {FEATURE_PIANO_UNICO.map((f) => (
              <View key={f.key} style={styles.featureItem}>
                <Icon name="circle-check" size="action" color={colors.semantic.success.foreground} />
                <View style={styles.featureTesti}>
                  <Text style={[textStyle('label'), styles.featureNome]}>{f.label}</Text>
                  <Text style={[textStyle('secondary'), styles.featureDesc]}>
                    {f.descrizione}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footerInfo}>
          <Text style={[textStyle('secondary'), styles.meta]}>
            Limite unità: {piano.limiteUnita === null ? 'Illimitate' : `${piano.limiteUnita} unità`}
            {` · Ultimo aggiornamento: ${formattaDataItaliana(piano.updatedAt)}`}
          </Text>
        </View>
      </Card>

      <Modal
        visible={modaleAperta}
        onClose={() => !salvataggio && setModaleAperta(false)}
        title="Modifica Piano Unico"
        description="Aggiorna il canone mensile e le note informative del piano piattaforma."
        dismissible={!salvataggio}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              disabled={salvataggio}
              onPress={() => setModaleAperta(false)}
            />
            <Button
              variant="primary"
              label="Salva modifiche"
              loading={salvataggio}
              loadingLabel="Salvataggio…"
              onPress={() => void salvaModifiche()}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          <Input
            label="Nome del piano"
            value={nomeInput}
            onChangeText={setNomeInput}
            required
            error={erroriForm.nome}
          />
          <Input
            label="Canone mensile (€)"
            value={prezzoInput}
            onChangeText={setPrezzoInput}
            keyboardType="decimal-pad"
            placeholder="29,00"
            required
            error={erroriForm.prezzoMensile}
          />
          <Textarea
            label="Note del piano"
            value={noteInput}
            onChangeText={setNoteInput}
            placeholder="Descrizione delle condizioni del piano unico…"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6] },
  pianoHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[4],
  },
  pianoTitoloBox: { flex: 1, minWidth: 240, gap: space[2] },
  titoloConBadge: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  titolo: { color: colors.text.primary },
  sottotitolo: { color: colors.text.secondary },
  prezzoBox: {
    alignItems: 'flex-end',
    backgroundColor: colors.tile.navy.background,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radii.card,
  },
  prezzo: { color: colors.brand.navy },
  periodo: { color: colors.text.secondary },
  separatore: { height: 1, backgroundColor: colors.border, marginVertical: space[5] },
  sezioneFeatures: { gap: space[4] },
  sezioneTitolo: { color: colors.text.primary },
  grigliaFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    minWidth: 260,
    flex: 1,
  },
  featureTesti: { flex: 1, gap: space[1] },
  featureNome: { color: colors.text.primary },
  featureDesc: { color: colors.text.secondary },
  footerInfo: { marginTop: space[5], paddingTop: space[4], borderTopWidth: 1, borderTopColor: colors.border },
  meta: { color: colors.text.muted },
  formModale: { gap: space[4] },
});
