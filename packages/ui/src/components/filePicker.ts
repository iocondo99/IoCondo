/**
 * Versione di riserva, per le piattaforme senza una scelta file propria: il pulsante di FileUpload
 * resta disattivato e lo spiega. Web e nativo usano filePicker.web.ts e filePicker.native.ts;
 * questo file serve anche al type-check.
 */
import type { DropHandlers, PickedFile, PickOptions } from './filePickerTypes';

export const canPickFiles = false;
export const canDropFiles = false;

export function pickFiles(_options: PickOptions): Promise<PickedFile[]> {
  return Promise.reject(new Error('La scelta dei file non è disponibile su questo dispositivo.'));
}

/** Trascinamento: solo web. Qui non fa nulla. */
export function attachDropZone(_element: unknown, _handlers: DropHandlers): () => void {
  return () => undefined;
}
