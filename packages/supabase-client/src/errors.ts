/** Errore uniforme sollevato dal service layer (nasconde i dettagli di PostgREST alla UI). */
export class ServiceError extends Error {
  readonly code: string | null;
  readonly details: string | null;

  constructor(message: string, code: string | null = null, details: string | null = null) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
  }

  /** 42501 = violazione RLS / permesso negato */
  get isForbidden() {
    return this.code === '42501';
  }
  /** 23505 = unique violation */
  get isDuplicate() {
    return this.code === '23505';
  }
}

interface PgResult<T> {
  data: T;
  error: { message: string; code?: string; details?: string } | null;
}

/** Estrae `data` o lancia ServiceError. */
export function unwrap<T>(res: PgResult<T>): NonNullable<T> {
  if (res.error) throw new ServiceError(res.error.message, res.error.code ?? null, res.error.details ?? null);
  if (res.data === null) throw new ServiceError('Nessun dato restituito');
  return res.data as NonNullable<T>;
}

/** Come unwrap ma ammette `null` (es. maybeSingle). */
export function unwrapMaybe<T>(res: PgResult<T>): NonNullable<T> | null {
  if (res.error) throw new ServiceError(res.error.message, res.error.code ?? null, res.error.details ?? null);
  return res.data as NonNullable<T> | null;
}

/** Per operazioni senza payload (delete/update senza select). */
export function assertOk(res: { error: { message: string; code?: string; details?: string } | null }): void {
  if (res.error) throw new ServiceError(res.error.message, res.error.code ?? null, res.error.details ?? null);
}
