import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeAccepted, validateFiles, type PickedFileInfo } from '../fileRules';
import { formatFileSize } from '../format';
import { Icon } from '../Icon';
import { tabularNumbers } from '../styles';
import { borderWidths, colors, dataSizes, radii, space } from '../tokens';
import { Button } from './Button';
import { attachDropZone, canDropFiles, canPickFiles, pickFiles } from './filePicker';
import type { PickedFile } from './filePickerTypes';
import { useTextStyle, type ViewRef } from './internal';

export type { PickedFile } from './filePickerTypes';

export type FileUploadStatus = 'pronto' | 'in-caricamento' | 'completato' | 'errore';

/** Un file nell'elenco: lo stato lo decide la schermata, che è quella che carica davvero. */
export interface FileUploadItem extends PickedFileInfo {
  id: string;
  status: FileUploadStatus;
  /** Avanzamento da 0 a 1, se noto. Senza, si mostra un indicatore generico. */
  progress?: number;
  /** Cosa è andato storto e cosa fare: compare con lo stato `errore`. */
  error?: string;
}

export interface FileUploadProps {
  /** Sempre visibile sopra l'area. */
  label: string;
  /** File scelti, con il loro stato. Li possiede il chiamante. */
  files: readonly FileUploadItem[];
  /**
   * Chiamata con i soli file validi appena scelti. Il componente NON li carica: lo fa la schermata,
   * con i permessi giusti. Con `multiple` false i file nuovi sostituiscono quello già presente.
   */
  onFilesSelected: (files: PickedFile[]) => void;
  onRemove: (file: FileUploadItem) => void;
  /** Se presente, i file in errore mostrano "Riprova". */
  onRetry?: (file: FileUploadItem) => void;
  multiple?: boolean;
  /** Tipi consentiti: MIME ("application/pdf"), con asterisco ("image/*") o estensioni (".pdf"). */
  accept?: readonly string[];
  maxSizeBytes?: number;
  /** Numero massimo di file in totale (solo con `multiple`). */
  maxFiles?: number;
  helperText?: string;
  /** Errore dal chiamante (es. "Allega almeno un documento."). */
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Scelta di uno o più file: pulsante "Scegli file" (e trascinamento su web), limiti di tipo e peso con
 * messaggi chiari, elenco dei file con nome, peso, stato, "Rimuovi" e, se serve, "Riprova".
 * Il componente espone solo callback; il caricamento vero (Supabase Storage) è della schermata.
 * Su Android e iOS il pulsante resta disattivato finché non viene scelta la libreria per i file.
 */
export function FileUpload({
  label,
  files,
  onFilesSelected,
  onRemove,
  onRetry,
  multiple = false,
  accept,
  maxSizeBytes,
  maxFiles,
  helperText,
  error,
  required,
  disabled = false,
}: FileUploadProps) {
  const [rejections, setRejections] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const zoneRef = useRef<ViewRef>(null);
  const labelStyle = useTextStyle('label');
  const bodyStyle = useTextStyle('body');
  const supportStyle = useTextStyle('secondary');

  const rules = { accept, maxSizeBytes, maxFiles, multiple };
  const receive = (picked: PickedFile[]) => {
    const { accepted, rejections: problems } = validateFiles(picked, rules, multiple ? files.length : 0);
    setRejections(problems);
    if (accepted.length > 0) onFilesSelected(accepted);
  };
  // L'area di trascinamento è registrata una volta sola: legge sempre l'ultima versione di `receive`.
  const receiveRef = useRef(receive);
  receiveRef.current = receive;

  useEffect(() => {
    if (!canDropFiles || disabled) return undefined;
    return attachDropZone(zoneRef.current, {
      onDragChange: setDragging,
      onDrop: (dropped) => receiveRef.current(dropped),
    });
  }, [disabled]);

  const pick = async () => {
    try {
      receive(await pickFiles({ accept, multiple }));
    } catch {
      setRejections(['Non è stato possibile aprire la scelta dei file. Riprova.']);
    }
  };

  const limits = [
    accept && accept.length > 0 ? describeAccepted(accept) : null,
    maxSizeBytes !== undefined ? `massimo ${formatFileSize(maxSizeBytes)} per file` : null,
    multiple && maxFiles ? `fino a ${maxFiles} file` : null,
  ].filter(Boolean);
  const hint = limits.length > 0 ? limits.join(' · ') : undefined;
  const message = error ?? helperText;
  const pickLabel = multiple ? (files.length > 0 ? 'Aggiungi file' : 'Scegli file') : files.length > 0 ? 'Cambia file' : 'Scegli file';

  return (
    <View style={styles.field}>
      <Text style={[labelStyle, styles.label]}>
        {label}
        {required ? <Text style={styles.required}> (obbligatorio)</Text> : null}
      </Text>

      <View
        ref={zoneRef}
        role="group"
        aria-label={label}
        style={[
          styles.zone,
          dragging && styles.zoneOver,
          error ? styles.zoneError : null,
          disabled && styles.zoneDisabled,
        ]}
      >
        <Icon name="upload" size="card" color={disabled ? colors.text.muted : colors.brand.navy} />
        {canDropFiles ? (
          <Text style={[bodyStyle, styles.zoneText]}>
            {dragging ? 'Rilascia qui per aggiungere' : 'Trascina qui i file oppure'}
          </Text>
        ) : null}
        <Button
          variant="secondary"
          label={pickLabel}
          icon="file-text"
          disabled={disabled || !canPickFiles}
          onPress={pick}
          accessibilityHint={hint ? `Tipi e limiti: ${hint}` : undefined}
        />
        {hint ? <Text style={[supportStyle, styles.zoneText]}>{hint}</Text> : null}
        {canPickFiles ? null : (
          <Text style={[supportStyle, styles.zoneText]}>
            La scelta dei file non è ancora disponibile su questo dispositivo.
          </Text>
        )}
      </View>

      {rejections.length > 0 ? (
        <View role="alert" style={styles.messages}>
          {rejections.map((text) => (
            <View key={text} style={styles.message}>
              <Icon name="circle-alert" size="indicator" color={colors.semantic.error.foreground} />
              <Text style={[supportStyle, styles.messageText, { color: colors.semantic.error.foreground }]}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {message ? (
        <View style={styles.message} role={error ? 'alert' : undefined}>
          {error ? <Icon name="circle-alert" size="indicator" color={colors.semantic.error.foreground} /> : null}
          <Text
            style={[
              supportStyle,
              styles.messageText,
              { color: error ? colors.semantic.error.foreground : colors.text.secondary },
            ]}
          >
            {message}
          </Text>
        </View>
      ) : null}

      {files.length > 0 ? (
        <View role="list" aria-label={`${label}: file scelti`} style={styles.list}>
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              disabled={disabled}
              onRemove={() => {
                setRejections([]);
                onRemove(file);
              }}
              onRetry={onRetry ? () => onRetry(file) : undefined}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FileRow({
  file,
  disabled,
  onRemove,
  onRetry,
}: {
  file: FileUploadItem;
  disabled: boolean;
  onRemove: () => void;
  onRetry?: () => void;
}) {
  const nameStyle = useTextStyle('body');
  const metaStyle = useTextStyle('secondary');
  const uploading = file.status === 'in-caricamento';
  const percent = file.progress === undefined ? undefined : Math.round(Math.min(Math.max(file.progress, 0), 1) * 100);

  const status =
    file.status === 'completato'
      ? { icon: 'circle-check' as const, text: 'Caricato', color: colors.semantic.success.foreground }
      : file.status === 'errore'
        ? {
            icon: 'circle-alert' as const,
            text: file.error ?? 'Non è stato possibile caricare il file. Riprova.',
            color: colors.semantic.error.foreground,
          }
        : uploading
          ? { icon: undefined, text: percent === undefined ? 'Caricamento in corso…' : `Caricamento in corso… ${percent}%`, color: colors.text.secondary }
          : { icon: 'clock' as const, text: 'Pronto da caricare', color: colors.text.secondary };

  return (
    <View role="listitem" style={styles.row}>
      <View style={styles.rowMain}>
        <Icon name="file-text" size="card" color={colors.brand.navy} />
        <View style={styles.rowText}>
          <Text style={[nameStyle, styles.fileName]}>{file.name}</Text>
          <View role="status" aria-live="polite" style={styles.statusLine}>
            {uploading ? (
              <View aria-hidden>
                <ActivityIndicator size="small" color={colors.action.default} />
              </View>
            ) : status.icon ? (
              <Icon name={status.icon} size="indicator" color={status.color} />
            ) : null}
            <Text style={[metaStyle, styles.statusText, { color: status.color }]}>
              <Text style={tabularNumbers}>{formatFileSize(file.size)}</Text>
              {` · ${status.text}`}
            </Text>
          </View>
          {uploading && percent !== undefined ? (
            <View
              role="progressbar"
              aria-label={`Caricamento di ${file.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.rowActions}>
        {file.status === 'errore' && onRetry ? (
          <Button
            variant="secondary"
            label="Riprova"
            icon="refresh-cw"
            disabled={disabled}
            onPress={onRetry}
            accessibilityHint={`Riprova a caricare ${file.name}`}
          />
        ) : null}
        <Button
          variant="text"
          label="Rimuovi"
          icon="x"
          disabled={disabled || uploading}
          onPress={onRemove}
          accessibilityHint={`Toglie ${file.name} dall’elenco`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch', gap: space[2] },
  label: { color: colors.text.primary },
  required: { color: colors.text.secondary },
  zone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    minHeight: dataSizes.dropZoneMinHeight,
    padding: space[4],
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radii.card,
  },
  zoneOver: { backgroundColor: colors.semantic.info.background, borderColor: colors.focus },
  zoneError: { borderColor: colors.semantic.error.foreground },
  zoneDisabled: { backgroundColor: colors.background },
  zoneText: { color: colors.text.secondary, textAlign: 'center' },
  messages: { gap: space[2] },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  messageText: { flex: 1 },
  list: { gap: space[2] },
  row: {
    gap: space[3],
    padding: space[3],
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.control,
  },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  rowText: { flex: 1, minWidth: 0, gap: space[1] },
  fileName: { color: colors.text.primary },
  statusLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  statusText: { flex: 1 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[2] },
  track: {
    height: dataSizes.progressHeight,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.action.default, borderRadius: radii.full },
});
