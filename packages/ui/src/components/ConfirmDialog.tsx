import React, { useRef, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { type ViewRef } from './internal';
import { Modal, ModalActions } from './Modal';

export interface ConfirmDialogProps {
  visible: boolean;
  /** Titolo che nomina l'azione (es. "Eliminare il documento?"). */
  title: string;
  /** Cosa succede se si conferma, in modo esplicito (es. "Il documento sarà eliminato per tutti e non si potrà recuperare."). */
  description: string;
  /** Mai solo "OK": dice cosa accade (es. "Elimina documento"). */
  confirmLabel: string;
  confirmLoadingLabel?: string;
  cancelLabel?: string;
  /** `true` (predefinito) per eliminazioni o operazioni irreversibili: pulsante rosso. */
  destructive?: boolean;
  /**
   * Eseguita alla conferma. Se restituisce una promessa, il pulsante resta in caricamento
   * finché non si risolve e il doppio invio è bloccato. Chi usa il componente chiude la
   * finestra (`visible={false}`) quando l'operazione è riuscita; se la promessa fallisce la
   * finestra resta aperta con un messaggio d'errore.
   */
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
  /** Contenuto in più sotto la descrizione (es. una casella "Ho capito le conseguenze"). */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  confirmLoadingLabel,
  cancelLabel = 'Annulla',
  destructive = true,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const locked = useRef(false);
  const cancelRef = useRef<ViewRef>(null);

  const handleConfirm = async () => {
    if (locked.current) return;
    locked.current = true;
    setFailed(false);
    setPending(true);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
    } finally {
      locked.current = false;
      setPending(false);
    }
  };

  const handleCancel = () => {
    setFailed(false);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      onClose={handleCancel}
      title={title}
      description={description}
      dismissible={!pending}
      closeLabel={cancelLabel}
      initialFocusRef={cancelRef}
      actions={
        <ModalActions>
          <Button
            buttonRef={cancelRef}
            variant="secondary"
            label={cancelLabel}
            disabled={pending}
            onPress={handleCancel}
          />
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            label={confirmLabel}
            loading={pending}
            loadingLabel={confirmLoadingLabel}
            onPress={handleConfirm}
          />
        </ModalActions>
      }
    >
      {children}
      {failed ? (
        <Alert
          tone="error"
          message="Non è stato possibile completare l’operazione. Controlla la connessione e riprova."
        />
      ) : null}
    </Modal>
  );
}
