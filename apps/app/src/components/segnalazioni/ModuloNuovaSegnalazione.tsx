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
const AREA_COMUNE = 'area-comune';
const PREFISSO_UNITA = 'unita:';

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

/** Modulo di apertura di una nuova segnalazione (condòmino) o ticket su area comune (portiere). */
export function ModuloNuovaSegnalazione(props: Props) {
  const { visible, onClose, modalita, utenteId, condominioId, onCreata } = props;
  const { breakpoint } = useBreakpoint();
  const inCondomino = modalita === 'condomino';

  const { blocco } = useBlocco(
    async () => {
      const [categorie, unita] = await Promise.all([
        services.segnalazioni.elencoCategorie(),
        inCondomino
          ? services.segnalazioni.unitaDelResidenteNelCondominio(utenteId, condominioId)
          : Promise.resolve([]),
      ]);
      return { categorie, unita };
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
    () => [
      ...(dati?.unita ?? []).map((u) => ({ value: `${PREFISSO_UNITA}${u.id}`, label: u.etichetta })),
      { value: AREA_COMUNE, label: 'Area comune' },
    ],
    [dati],
  );

  const ambitoCorrente =
    ambito ?? (dati ? (dati.unita[0] ? `${PREFISSO_UNITA}${dati.unita[0].id}` : AREA_COMUNE) : null);

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
    const isAreaComune = !inCondomino || ambitoCorrente === AREA_COMUNE;
    const unitaId =
      !isAreaComune && ambitoCorrente?.startsWith(PREFISSO_UNITA)
        ? ambitoCorrente.slice(PREFISSO_UNITA.length)
        : null;
    const unitaIds = (dati?.unita ?? []).map((u) => u.id);

    const input = {
      titolo,
      descrizione,
      categoriaId: categoria === NESSUNA_CATEGORIA ? null : categoria,
      isAreaComune,
      unitaId,
      priorita: priorita as PrioritaTicket,
      allegati: foto.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    };
    const validazione = validaInputNuovaSegnalazione(input, unitaIds, modalita);
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
      setErroreInvio('Non è stato possibile inviare la segnalazione. Controlla la connessione e riprova.');
    } finally {
      setInvio(false);
    }
  }, [
    ambitoCorrente, categoria, condominioId, dati, descrizione, foto, inCondomino, invio,
    modalita, onCreata, priorita, titolo, utenteId,
  ]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      dismissible={!invio}
      title={inCondomino ? 'Nuova segnalazione' : 'Nuovo ticket su area comune'}
      description={
        inCondomino
          ? 'Descrivi il problema: l’amministratore la riceverà e potrà aggiornarti.'
          : 'Il ticket sarà registrato come area comune del condominio.'
      }
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
          <Alert tone="error" message="Non è stato possibile caricare categorie e unità. Chiudi e riprova." />
        ) : null}
        {erroreInvio ? <Alert tone="error" message={erroreInvio} /> : null}
        <Input
          label="Titolo"
          required
          value={titolo}
          onChangeText={setTitolo}
          placeholder="Es. Perdita d’acqua nel corridoio"
          maxLength={MAX_LUNGHEZZA_TITOLO_TICKET}
          error={errori.titolo}
          inputRef={titoloRef}
        />
        <Textarea
          label="Descrizione"
          value={descrizione}
          onChangeText={setDescrizione}
          placeholder="Racconta cosa è successo e dove"
          maxLength={MAX_LUNGHEZZA_DESCRIZIONE_TICKET}
          error={errori.descrizione}
        />
        <Select
          label="Categoria"
          options={opzioniCategoria}
          value={categoria}
          onChange={setCategoria}
          disabled={!dati}
        />
        {inCondomino ? (
          <Select
            label="Dove si trova il problema"
            required
            options={opzioniAmbito}
            value={ambitoCorrente}
            onChange={setAmbito}
            disabled={!dati}
            error={errori.ambito}
          />
        ) : null}
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
          Il cambio di stato e l’assegnazione dell’intervento sono gestiti dall’amministratore.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  campi: { gap: space[4] },
  nota: { color: colors.text.secondary },
});

