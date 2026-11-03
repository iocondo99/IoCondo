/**
 * Regole di scelta dei file per FileUpload: tipo, peso e numero, con messaggi in italiano.
 * File puro, testato con `node --test`.
 */
import { formatFileSize } from './format.ts';

/** Descrizione minima di un file scelto dall'utente. */
export interface PickedFileInfo {
  name: string;
  size: number;
  /** Tipo MIME, se noto (es. "application/pdf"). */
  type?: string;
}

const KNOWN_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/*': 'immagini',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/heic': 'HEIC',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  '.pdf': 'PDF',
  '.jpg': 'JPG',
  '.jpeg': 'JPG',
  '.png': 'PNG',
  '.webp': 'WEBP',
  '.heic': 'HEIC',
  '.doc': 'Word',
  '.docx': 'Word',
  '.xls': 'Excel',
  '.xlsx': 'Excel',
};

/** Tipi consentiti in parole semplici: ["application/pdf", "image/*"] → "PDF, immagini". */
export function describeAccepted(accept: readonly string[]): string {
  const labels = accept.map((item) => KNOWN_LABELS[item.toLowerCase()] ?? item.replace(/^\./, '').toUpperCase());
  return [...new Set(labels)].join(', ');
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/** Un file passa se corrisponde a un MIME esatto, a un MIME con `*` (image/*) o a un'estensione. Senza `accept` passa tutto. */
export function isFileAccepted(file: PickedFileInfo, accept?: readonly string[]): boolean {
  if (!accept || accept.length === 0) return true;
  const type = (file.type ?? '').toLowerCase();
  const extension = extensionOf(file.name);
  return accept.some((rule) => {
    const item = rule.trim().toLowerCase();
    if (item.startsWith('.')) return extension === item;
    if (item.endsWith('/*')) return type.startsWith(item.slice(0, -1));
    return type === item;
  });
}

export interface FileRules {
  accept?: readonly string[];
  maxSizeBytes?: number;
  /** Quanti file in tutto, compresi quelli già scelti. */
  maxFiles?: number;
  multiple?: boolean;
}

export interface FileValidation<T extends PickedFileInfo> {
  accepted: T[];
  /** Un messaggio per ogni problema, in italiano semplice. */
  rejections: string[];
}

export function validateFiles<T extends PickedFileInfo>(
  candidates: readonly T[],
  rules: FileRules,
  alreadyChosen = 0,
): FileValidation<T> {
  const accepted: T[] = [];
  const rejections: string[] = [];
  const room = rules.multiple ? (rules.maxFiles ?? Infinity) - alreadyChosen : 1;

  for (const file of candidates) {
    if (rules.accept && !isFileAccepted(file, rules.accept)) {
      rejections.push(
        `“${file.name}” non è un tipo di file consentito. Puoi scegliere: ${describeAccepted(rules.accept)}.`,
      );
    } else if (rules.maxSizeBytes !== undefined && file.size > rules.maxSizeBytes) {
      rejections.push(
        `“${file.name}” pesa ${formatFileSize(file.size)}: il limite è ${formatFileSize(rules.maxSizeBytes)}. Scegli un file più leggero.`,
      );
    } else if (accepted.length >= room) {
      rejections.push(
        rules.multiple
          ? `“${file.name}” non è stato aggiunto: puoi scegliere al massimo ${rules.maxFiles} file.`
          : `Puoi scegliere un solo file: “${file.name}” non è stato aggiunto.`,
      );
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejections };
}
