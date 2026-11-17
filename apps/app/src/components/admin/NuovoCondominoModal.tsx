import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  isEmailValida,
  type StrutturaAdminData,
} from '@iocondo/data';
import {
  Alert,
  Button,
  Checkbox,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  RadioGroup,
  Select,
  colors,
  space,
  textStyle,
  useToast,
  type SelectOption,
} from '@iocondo/ui';
import { services } from '@/services';

export interface NuovoCondominoModalProps {
  visible: boolean;
  condominioId: string;
  strutturaIniziale?: StrutturaAdminData | null;
  onClose: () => void;
  onSuccess: () => void;
}

const NESSUNA_SCALA = '__nessuna__';

export function NuovoCondominoModal({
  visible,
  condominioId,
  strutturaIniziale,
  onClose,
  onSuccess,
}: NuovoCondominoModalProps) {
  const toast = useToast();

  const [struttura, setStruttura] = useState<StrutturaAdminData | null>(
    strutturaIniziale ?? null,
  );
  const [caricamentoStruttura, setCaricamentoStruttura] = useState(false);

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [palazzoId, setPalazzoId] = useState('');
  const [scalaId, setScalaId] = useState(NESSUNA_SCALA);
  const [modoUnita, setModoUnita] = useState<'esistente' | 'nuova'>('esistente');
  const [unitaId, setUnitaId] = useState('');
  const [internoNuovo, setInternoNuovo] = useState('');
  const [pianoNuovo, setPianoNuovo] = useState('');
  const [tipologiaId, setTipologiaId] = useState('');
  const [flagPortiere, setFlagPortiere] = useState(false);

  const [erroreForm, setErroreForm] = useState<string | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErroreForm(null);
    setNome('');
    setCognome('');
    setEmail('');
    setFlagPortiere(false);
    setInternoNuovo('');
    setPianoNuovo('');

    if (strutturaIniziale) {
      setStruttura(strutturaIniziale);
      const primoPalazzo = strutturaIniziale.palazzi[0]?.id ?? '';
      setPalazzoId(primoPalazzo);
      setScalaId(NESSUNA_SCALA);
      setTipologiaId(strutturaIniziale.tipologie[0]?.id ?? '');
      return;
    }

    let attivo = true;
    setCaricamentoStruttura(true);
    services.struttura
      .caricaStrutturaCompleta(condominioId)
      .then((res) => {
        if (!attivo) return;
        setStruttura(res);
        setPalazzoId(res.palazzi[0]?.id ?? '');
        setScalaId(NESSUNA_SCALA);
        setTipologiaId(res.tipologie[0]?.id ?? '');
      })
      .catch(() => {
        if (attivo) setErroreForm('Impossibile caricare palazzi e scale del condominio.');
      })
      .finally(() => {
        if (attivo) setCaricamentoStruttura(false);
      });

    return () => {
      attivo = false;
    };
  }, [visible, condominioId, strutturaIniziale]);

  const palazzoSelezionato = useMemo(
    () => struttura?.palazzi.find((p) => p.id === palazzoId) ?? null,
    [struttura, palazzoId],
  );

  const opzioniPalazzi: SelectOption[] = useMemo(
    () => (struttura?.palazzi ?? []).map((p) => ({ value: p.id, label: p.nome })),
    [struttura],
  );

  const opzioniScale: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [{ value: NESSUNA_SCALA, label: 'Nessuna scala / colonna' }];
    if (!palazzoSelezionato) return base;
    for (const s of palazzoSelezionato.scale) {
      if (!s.id) continue;
      const tipoLabel = s.tipo === 'COLONNA' ? 'Colonna' : 'Scala';
      base.push({ value: s.id, label: `${s.nome} (${tipoLabel})` });
    }
    return base;
  }, [palazzoSelezionato]);

  const opzioniUnita: SelectOption[] = useMemo(() => {
    if (!palazzoSelezionato) return [];
    const lista: SelectOption[] = [];
    for (const gruppo of palazzoSelezionato.scale) {
      if (scalaId !== NESSUNA_SCALA && gruppo.id !== scalaId) continue;
      for (const u of gruppo.unita) {
        const parteScala = u.scalaNome ? ` • ${u.scalaNome}` : '';
        const partePiano = u.piano !== null && u.piano !== undefined ? ` (Piano ${u.piano})` : '';
        const statoRes = u.residenteAttivo ? ` — ${u.residenteAttivo.nomeCognome}` : '';
        lista.push({
          value: u.id,
          label: `Int. ${u.interno}${parteScala}${partePiano}${statoRes}`,
        });
      }
    }
    return lista;
  }, [palazzoSelezionato, scalaId]);

  const opzioniTipologie: SelectOption[] = useMemo(
    () => (struttura?.tipologie ?? []).map((t) => ({ value: t.id, label: t.descrizione })),
    [struttura],
  );

  useEffect(() => {
    if (opzioniUnita.length > 0) {
      if (!opzioniUnita.some((o) => o.value === unitaId)) {
        setUnitaId(opzioniUnita[0]?.value ?? '');
      }
    } else {
      setUnitaId('');
      if (palazzoSelezionato && modoUnita === 'esistente') {
        setModoUnita('nuova');
      }
    }
  }, [opzioniUnita, unitaId, palazzoSelezionato, modoUnita]);

  const handleCreaEInvita = async () => {
    setErroreForm(null);
    const nomePulito = nome.trim();
    const cognomePulito = cognome.trim();
    if (!nomePulito || !cognomePulito) {
      setErroreForm('Inserisci nome e cognome del nuovo condòmino.');
      return;
    }
    const emailPulita = email.trim().toLowerCase();
    if (!isEmailValida(emailPulita)) {
      setErroreForm('Inserisci un indirizzo email valido per inviare l’invito.');
      return;
    }
    if (!palazzoId) {
      setErroreForm('Seleziona un edificio / palazzo.');
      return;
    }

    let targetUnitaId = unitaId;
    if (modoUnita === 'nuova') {
      if (!internoNuovo.trim()) {
        setErroreForm('Inserisci il numero/codice interno della nuova unità.');
        return;
      }
      if (!tipologiaId) {
        setErroreForm('Seleziona la tipologia dell’unità.');
        return;
      }
    } else if (!targetUnitaId) {
      setErroreForm('Seleziona un’unità esistente oppure scegli "Crea nuova unità".');
      return;
    }

    setSalvataggio(true);
    try {
      if (modoUnita === 'nuova') {
        const pianoParsed = pianoNuovo.trim() !== '' ? Number.parseInt(pianoNuovo.trim(), 10) : null;
        if (pianoNuovo.trim() !== '' && Number.isNaN(pianoParsed)) {
          setErroreForm('Il piano deve essere un numero intero.');
          setSalvataggio(false);
          return;
        }
        const nuovaUnita = await services.struttura.creaUnita({
          condominioId,
          palazzoId,
          scalaColonnaId: scalaId !== NESSUNA_SCALA ? scalaId : null,
          tipologiaId,
          interno: internoNuovo.trim(),
          piano: pianoParsed,
        });
        targetUnitaId = nuovaUnita.id;
      }

      await services.invitiAdmin.invia({
        email: emailPulita,
        nomeCognome: `${nomePulito} ${cognomePulito}`,
        ruolo: 'CONDOMINO',
        condominioId,
        unitaId: targetUnitaId,
        flagPortiere,
      });

      toast.show({
        tone: 'success',
        message: 'Unità collegata e invito inviato al nuovo condòmino.',
      });
      onClose();
      onSuccess();
    } catch (err: unknown) {
      setErroreForm(
        err instanceof Error ? err.message : 'Errore durante la creazione o l’invio dell’invito.',
      );
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <Modal
      visible={visible}
      title="Aggiungi nuovo condòmino"
      description="Inserisci l'email del condòmino, collegalo a palazzo, scala o colonna e unità: partirà subito l'invito."
      onClose={() => !salvataggio && onClose()}
      dismissible={!salvataggio}
      actions={
        <ModalActions>
          <Button
            variant="secondary"
            label="Annulla"
            onPress={onClose}
            disabled={salvataggio}
          />
          <Button
            variant="primary"
            label="Crea e invia invito"
            icon="mail-plus"
            onPress={() => void handleCreaEInvita()}
            loading={salvataggio}
            disabled={caricamentoStruttura || opzioniPalazzi.length === 0}
          />
        </ModalActions>
      }
    >
      {caricamentoStruttura ? (
        <LoadingState message="Caricamento palazzi e scale…" />
      ) : opzioniPalazzi.length === 0 ? (
        <Alert
          tone="warning"
          message="Nessun edificio presente nel condominio. Crea prima almeno un palazzo nella sezione Struttura."
        />
      ) : (
        <View style={styles.form}>
          {erroreForm ? <Alert tone="error" message={erroreForm} /> : null}

          <Input
            label="Nome *"
            value={nome}
            onChangeText={(v) => {
              setNome(v);
              if (erroreForm) setErroreForm(null);
            }}
            placeholder="es. Mario"
          />

          <Input
            label="Cognome *"
            value={cognome}
            onChangeText={(v) => {
              setCognome(v);
              if (erroreForm) setErroreForm(null);
            }}
            placeholder="es. Rossi"
          />

          <Input
            label="Email del condòmino *"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (erroreForm) setErroreForm(null);
            }}
            placeholder="nome.cognome@esempio.it"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Select
            label="Palazzo / Edificio *"
            value={palazzoId}
            onChange={(val) => {
              setPalazzoId(val);
              setScalaId(NESSUNA_SCALA);
            }}
            options={opzioniPalazzi}
          />

          <Select
            label="Scala o Colonna (opzionale)"
            value={scalaId}
            onChange={setScalaId}
            options={opzioniScale}
          />

          <RadioGroup
            label="Unità immobiliare"
            value={modoUnita}
            onChange={(v) => setModoUnita(v as 'esistente' | 'nuova')}
            options={[
              {
                value: 'esistente',
                label: 'Collega a unità esistente',
                disabled: opzioniUnita.length === 0,
              },
              { value: 'nuova', label: 'Crea nuova unità' },
            ]}
          />

          {modoUnita === 'esistente' ? (
            opzioniUnita.length > 0 ? (
              <Select
                label="Seleziona unità *"
                value={unitaId}
                onChange={setUnitaId}
                options={opzioniUnita}
              />
            ) : (
              <Text style={[textStyle('secondary'), styles.nota]}>
                Nessuna unità disponibile per questa selezione: usa "Crea nuova unità".
              </Text>
            )
          ) : (
            <View style={styles.nuovaUnitaBox}>
              <View style={styles.rigaDueColonne}>
                <View style={styles.colonna}>
                  <Input
                    label="Interno *"
                    value={internoNuovo}
                    onChangeText={setInternoNuovo}
                    placeholder="Es. 4"
                  />
                </View>
                <View style={styles.colonna}>
                  <Input
                    label="Piano"
                    value={pianoNuovo}
                    onChangeText={setPianoNuovo}
                    placeholder="Es. 2"
                    keyboardType="numeric"
                  />
                </View>
              </View>
              {opzioniTipologie.length > 0 ? (
                <Select
                  label="Tipologia unità *"
                  value={tipologiaId}
                  onChange={setTipologiaId}
                  options={opzioniTipologie}
                />
              ) : null}
            </View>
          )}

          <Checkbox
            checked={flagPortiere}
            onChange={setFlagPortiere}
            label="Assegna anche mansione Portiere (utente ibrido)"
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space[3],
  },
  nuovaUnitaBox: {
    gap: space[3],
    paddingTop: space[1],
  },
  rigaDueColonne: {
    flexDirection: 'row',
    gap: space[3],
  },
  colonna: {
    flex: 1,
  },
  nota: {
    color: colors.text.muted,
  },
});
