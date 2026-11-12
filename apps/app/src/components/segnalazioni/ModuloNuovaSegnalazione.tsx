import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ACCEPT_FOTO_TICKET,
  MAX_DIMENSIONE_FOTO_BYTES,
  MAX_FOTO_PER_TICKET,
  MAX_LUNGHEZZA_DESCRIZIONE_TICKET,
  MAX_LUNGHEZZA_TITOLO_TICKET,
  validaInputNuovaSegnalazione,
  type ModalitaSegnalazioni,
  type OpzioneAmbitoTicket,
  type PrioritaTicket,
} from '@iocondo/data';
import {
  Alert,
  Button,
  FileUpload,
  Input,
  Modal,
  ModalActions,
  Select,
  Textarea,
  colors,
  space,
  textStyle,
  useBreakpoint,
  type FileUploadItem,
  type PickedFile,
  type SelectOption,
} from '@iocondo/ui';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const NESSUNA_CATEGORIA = 'nessuna';

const OPZIONI_PRIORITA: readonly SelectOption[] = [
  { value: 'BASSA', label: 'Bassa' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  modalita: ModalitaSegnalazioni;
  utenteId: string;
  condominioId: string;
  /** Chiamata dopo la creazione: la schermata ricarica l'elenco. */
  onCreata: (ticketId: string, fotoNonCaricate: string[]) => void;
}

/** Modulo di apertura di una segnalazione su ambito condiviso (condominio, palazzo o scala). */
export function ModuloNuovaSegnalazione(props: Props) {
  const { visible, onClose, modalita, utenteId, condominioId, onCreata } = props;
  const { breakpoint } = useBreakpoint();
  const inCondomino = modalita === 'condomino';

  const { blocco } = useBlocco(
    async () => {
      const [categorie, ambiti] = await Promise.all([
        services.segnalazioni.elencoCategorie(),
        services.segnalazioni.ambitiSelezionabili(utenteId, condominioId, modalita),
      ]);
      return { categorie, ambiti };
    },
    `${utenteId}|${condominioId}|${modalita}`,
    visible,
  );
  const dati = blocco.stato === 'pronto' ? blocco.dati : null;

  const [titolo, setTitolo] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [categoria, setCategoria] = useState<string>(NESSUNA_CATEGORIA);
  const [ambito, setAmbito] = useState<string | null>(null);
  const [priorita, setPriorita] = useState<string>('MEDIA');
  const [foto, setFoto] = useState<PickedFile[]>([]);
  const [erroriFoto, setErroriFoto] = useState<string | undefined>();
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [invio, setInvio] = useState(false);
  const [erroreInvio, setErroreInvio] = useState<string | null>(null);
  const titoloRef = useRef<React.ComponentRef<typeof Input> | null>(null);

  useEffect(() => {
    if (!visible) {
      setTitolo('');
      setDescrizione('');
      setCategoria(NESSUNA_CATEGORIA);
      setAmbito(null);
      setPriorita('MEDIA');
      setFoto([]);
      setErroriFoto(undefined);
      setErrori({});
      setErroreInvio(null);
      setInvio(false);
    }
  }, [visible]);

  const opzioniCategoria: SelectOption[] = useMemo(
    () => [
      { value: NESSUNA_CATEGORIA, label: 'Nessuna categoria' },
      ...(dati?.categorie ?? []).map((c) => ({ value: c.id, label: c.nome })),
    ],
    [dati],
  );

  const opzioniAmbito: SelectOption[] = useMemo(
    () => (dati?.ambiti ?? []).map((a) => ({ value: a.id, label: a.etichetta })),
    [dati],
  );

  const ambitoCorrente = ambito ?? dati?.ambiti[0]?.id ?? 'condominio';

  const elementiFoto: FileUploadItem[] = foto.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    type: f.type,
    status: 'pronto',
  }));

  const scegliFoto = useCallback((nuove: PickedFile[]) => {
    setErroriFoto(undefined);
    setFoto((precedenti) => [...precedenti, ...nuove].slice(0, MAX_FOTO_PER_TICKET));
  }, []);

  const invia = useCallback(async () => {
    if (invio) return;
    setErroreInvio(null);

    const ambitoSelezionato: OpzioneAmbitoTicket | undefined = (dati?.ambiti ?? []).find(
      (a) => a.id === ambitoCorrente,
    );

    const input = {
      titolo,
      descrizione,
      categoriaId: categoria === NESSUNA_CATEGORIA ? null : categoria,
      ambitoTipo: ambitoSelezionato?.tipo ?? 'CONDOMINIO',
      palazzoId: ambitoSelezionato?.palazzoId ?? null,
      scalaColonnaId: ambitoSelezionato?.scalaColonnaId ?? null,
      priorita: priorita as PrioritaTicket,
      allegati: foto.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    };

    const validazione = validaInputNuovaSegnalazione(input, dati?.ambiti, modalita);
    if (!validazione.valido) {
      setErrori(validazione.errori as Record<string, string>);
      setErroriFoto(validazione.errori.allegati);
      return;
    }
    setErrori({});

    setInvio(true);
    try {
      const allegati = await Promise.all(
        foto.map(async (f) => {
          let body: Blob | ArrayBuffer;
          if (f.file) {
            body = f.file as Blob;
          } else if (f.uri) {
            const risposta = await fetch(f.uri);
            body = await risposta.arrayBuffer();
          } else {
            throw new Error('file non leggibile');
          }
          return { name: f.name, size: f.size, type: f.type, body };
        }),
      );
      const esito = await services.segnalazioni.creaSegnalazione(
        utenteId,
        condominioId,
        { ...input, allegati },
        modalita,
      );
      if (!esito.ok) {
        setErrori(esito.errori);
        return;
      }
      onCreata(esito.ticketId, esito.fotoNonCaricate);
    } catch {
      setErroreInvio(
        'Non è stato possibile inviare la segnalazione. Controlla la connessione e riprova.',
      );
    } finally {
      setInvio(false);
    }
  }, [
    ambitoCorrente,
    categoria,
    condominioId,
    dati,
    descrizione,
    foto,
    invio,
    modalita,
    onCreata,
    priorita,
    titolo,
    utenteId,
  ]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      dismissible={!invio}
      title={inCondomino ? 'Nuova segnalazione' : 'Nuovo ticket su area comune'}
      description="Segnala un guasto o problema su parti comuni o sulla tua scala per informare l'amministrazione e i vicini interessati."
      initialFocusRef={titoloRef}
      actions={
        <ModalActions>
          <Button label="Annulla" variant="secondary" onPress={onClose} disabled={invio} />
          <Button
            label="Invia segnalazione"
            loadingLabel="Invio in corso…"
            loading={invio}
            disabled={blocco.stato !== 'pronto'}
            onPress={() => void invia()}
          />
        </ModalActions>
      }
    >
      <View style={styles.campi}>
        {blocco.stato === 'errore' ? (
          <Alert
            tone="error"
            message="Non è stato possibile caricare le categorie e gli ambiti. Chiudi e riprova."
          />
        ) : null}
        {erroreInvio ? <Alert tone="error" message={erroreInvio} /> : null}
        <Input
          label="Titolo del guasto"
          required
          value={titolo}
          onChangeText={setTitolo}
          placeholder="Es. Scalino scheggiato, cancello carraio bloccato"
          maxLength={MAX_LUNGHEZZA_TITOLO_TICKET}
          error={errori.titolo}
          inputRef={titoloRef}
        />
        <Textarea
          label="Descrizione del problema"
          value={descrizione}
          onChangeText={setDescrizione}
          placeholder="Descrivi cosa è successo e dove si trova con precisione"
          maxLength={MAX_LUNGHEZZA_DESCRIZIONE_TICKET}
          error={errori.descrizione}
        />
        <Select
          label="Categoria del guasto"
          options={opzioniCategoria}
          value={categoria}
          onChange={setCategoria}
          disabled={!dati}
        />
        <Select
          label="Dove si trova il guasto (Ambito)"
          required
          options={opzioniAmbito}
          value={ambitoCorrente}
          onChange={setAmbito}
          disabled={!dati}
          error={errori.ambito}
          helperText="La segnalazione sarà visibile ai condòmini dell'area o scala interessata per evitare segnalazioni duplicate."
        />
        <Select
          label="Priorità"
          options={OPZIONI_PRIORITA}
          value={priorita}
          onChange={setPriorita}
          error={errori.priorita}
        />
        <FileUpload
          label="Foto del guasto"
          multiple
          accept={ACCEPT_FOTO_TICKET}
          maxSizeBytes={MAX_DIMENSIONE_FOTO_BYTES}
          maxFiles={MAX_FOTO_PER_TICKET}
          files={elementiFoto}
          onFilesSelected={scegliFoto}
          onRemove={(item) => setFoto((prec) => prec.filter((f) => f.id !== item.id))}
          helperText="Facoltative. Formati JPEG, PNG, WEBP o HEIC, fino a 15 MB ciascuna."
          error={erroriFoto}
          disabled={invio}
        />
        <Text style={[textStyle('secondary', breakpoint), styles.nota]}>
          Il cambio di stato e l’eventuale assegnazione del fornitore sono gestiti dall’amministratore.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  campi: { gap: space[4], paddingBottom: space[2] },
  nota: { color: colors.text.secondary },
});
