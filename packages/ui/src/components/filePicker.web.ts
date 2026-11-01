/**
 * Scelta dei file su web, senza librerie: un campo `input type="file"` creato al momento
 * (il browser apre la finestra di scelta file) e il trascinamento sull'area di FileUpload.
 * Il DOM si legge da `globalThis` perché il pacchetto non dipende dai tipi del browser.
 */
import { nextFileId, type DropHandlers, type PickedFile, type PickOptions } from './filePickerTypes';

export const canPickFiles = true;
export const canDropFiles = true;

interface BrowserFile {
  name: string;
  size: number;
  type: string;
}

interface BrowserElement {
  addEventListener(type: string, listener: (event: BrowserEvent) => void): void;
  removeEventListener(type: string, listener: (event: BrowserEvent) => void): void;
  contains?(other: unknown): boolean;
  type?: string;
  accept?: string;
  multiple?: boolean;
  files?: ArrayLike<BrowserFile> | null;
  style?: { display: string };
  click?(): void;
  remove?(): void;
}

interface BrowserEvent {
  preventDefault(): void;
  relatedTarget?: unknown;
  dataTransfer?: { files?: ArrayLike<BrowserFile> | null; dropEffect?: string } | null;
}

function toPicked(file: BrowserFile): PickedFile {
  return { id: nextFileId(), name: file.name, size: file.size, type: file.type || undefined, file };
}

function toPickedList(files: ArrayLike<BrowserFile> | null | undefined): PickedFile[] {
  return Array.from(files ?? [], toPicked);
}

export function pickFiles({ accept, multiple }: PickOptions): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    const doc = (globalThis as unknown as {
      document?: { createElement(tag: string): BrowserElement; body: { appendChild(node: unknown): void } };
    }).document;
    if (!doc) return reject(new Error('La scelta dei file non è disponibile.'));

    const input = doc.createElement('input');
    input.type = 'file';
    if (accept && accept.length > 0) input.accept = accept.join(',');
    input.multiple = Boolean(multiple);
    if (input.style) input.style.display = 'none';

    const finish = (files: PickedFile[]) => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      input.remove?.();
      resolve(files);
    };
    const onChange = () => finish(toPickedList(input.files));
    // Chiudere la finestra senza scegliere non è un errore: si resta con l'elenco di prima.
    const onCancel = () => finish([]);

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    // Safari su iPhone ignora i campi che non sono nella pagina.
    doc.body.appendChild(input);
    input.click?.();
  });
}

/** Trascinamento dei file sull'elemento. Restituisce la funzione che toglie gli ascoltatori. */
export function attachDropZone(element: unknown, { onDragChange, onDrop }: DropHandlers): () => void {
  const node = element as BrowserElement | null;
  if (!node || typeof node.addEventListener !== 'function') return () => undefined;

  const onOver = (event: BrowserEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    onDragChange(true);
  };
  const onLeave = (event: BrowserEvent) => {
    // Passare sopra un elemento interno genera un "leave": conta solo se si esce dall'area.
    if (event.relatedTarget && node.contains?.(event.relatedTarget)) return;
    onDragChange(false);
  };
  const onDropEvent = (event: BrowserEvent) => {
    event.preventDefault();
    onDragChange(false);
    const files = toPickedList(event.dataTransfer?.files);
    if (files.length > 0) onDrop(files);
  };

  node.addEventListener('dragenter', onOver);
  node.addEventListener('dragover', onOver);
  node.addEventListener('dragleave', onLeave);
  node.addEventListener('drop', onDropEvent);
  return () => {
    node.removeEventListener('dragenter', onOver);
    node.removeEventListener('dragover', onOver);
    node.removeEventListener('dragleave', onLeave);
    node.removeEventListener('drop', onDropEvent);
  };
}
