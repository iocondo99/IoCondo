import type { PickedFileInfo } from '../fileRules';

/** Un file scelto dall'utente, pronto per essere caricato dalla schermata. */
export interface PickedFile extends PickedFileInfo {
  /** Identificativo locale, stabile finché il file resta nell'elenco. */
  id: string;
  /** Percorso locale (nativo). */
  uri?: string;
  /** Oggetto `File` originale (web): serve per l'invio con FormData o con l'SDK di Storage. */
  file?: unknown;
}

export interface PickOptions {
  accept?: readonly string[];
  multiple?: boolean;
}

export interface DropHandlers {
  onDragChange: (over: boolean) => void;
  onDrop: (files: PickedFile[]) => void;
}

let counter = 0;
/** Identificativo locale per un file appena scelto. */
export function nextFileId(): string {
  counter += 1;
  return `file-${Date.now().toString(36)}-${counter}`;
}
