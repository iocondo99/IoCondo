/**
 * Scelta dei file su Android e iOS, con il selettore di sistema (expo-document-picker).
 * Il selettore filtra solo per tipo MIME: estensioni, tipi mancanti e peso li controlla poi
 * FileUpload con fileRules.ts, e i messaggi in italiano sono gli stessi del web.
 * Il trascinamento esiste solo su web.
 */
import * as DocumentPicker from 'expo-document-picker';
import { nextFileId, type DropHandlers, type PickedFile, type PickOptions } from './filePickerTypes';

export const canPickFiles = true;
export const canDropFiles = false;

export async function pickFiles({ accept, multiple }: PickOptions): Promise<PickedFile[]> {
  // Le regole con il punto (".pdf") non sono tipi MIME: il selettore le ignora e le applica fileRules.
  const types = (accept ?? []).filter((rule) => !rule.trim().startsWith('.'));
  const result = await DocumentPicker.getDocumentAsync({
    type: types.length > 0 ? types : '*/*',
    multiple: Boolean(multiple),
    // La copia in cache serve perché la schermata possa leggere il file e caricarlo.
    copyToCacheDirectory: true,
  });
  // Chiudere il selettore senza scegliere non è un errore: si resta con l'elenco di prima.
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    id: nextFileId(),
    name: asset.name,
    size: asset.size ?? 0,
    type: asset.mimeType ?? undefined,
    uri: asset.uri,
  }));
}

/** Trascinamento: solo web. Qui non fa nulla. */
export function attachDropZone(_element: unknown, _handlers: DropHandlers): () => void {
  return () => undefined;
}
