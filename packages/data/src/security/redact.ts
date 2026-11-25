/**
 * Oscura dati personali, token e identificativi dai messaggi di errore o log client
 * prima dell'invio al backend (`registra_errore_app`): email, Bearer, JWT, UUID,
 * token esadecimali (>= 32 hex), IBAN e sequenze numeriche lunghe.
 */
export function oscuraTestoSensibile(testo: string): string {
  return testo
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [token]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[hex-token]')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi, '[iban]')
    .replace(/\d{7,}/g, '[numero]')
    .slice(0, 1000);
}
