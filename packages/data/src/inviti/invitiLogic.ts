/**
 * Inviti: stato, ruoli e testi. Logica pura (nessun Supabase né React), si testa con `node --test`.
 * Chi può invitare chi lo decide il database (`crea_invito`); qui si decide solo cosa mostrare.
 */

export type RuoloInvitabile = 'CONDOMINO' | 'PORTIERE' | 'ADMIN';
export type StatoInvito = 'in-attesa' | 'accettato' | 'scaduto';

export interface RigaInvito {
  email: string;
  ruolo: RuoloInvitabile;
  flagPortiere: boolean;
  unitaId: string | null;
  scadenza: string;
  accettatoAt: string | null;
}

/** Accettato se la riga lo dice; altrimenti scaduto quando la scadenza è passata (stessa regola del database). */
export function statoInvito(riga: Pick<RigaInvito, 'scadenza' | 'accettatoAt'>, adesso: Date): StatoInvito {
  if (riga.accettatoAt) return 'accettato';
  return new Date(riga.scadenza).getTime() > adesso.getTime() ? 'in-attesa' : 'scaduto';
}

const ETICHETTE_RUOLO: Record<RuoloInvitabile, string> = {
  CONDOMINO: 'Condòmino',
  PORTIERE: 'Portiere',
  ADMIN: 'Amministratore',
};

export function etichettaRuoloInvito(ruolo: RuoloInvitabile, flagPortiere: boolean): string {
  return ruolo === 'CONDOMINO' && flagPortiere ? 'Condòmino e portiere' : ETICHETTE_RUOLO[ruolo];
}

/** Ruoli che l'utente può proporre: ADMIN solo al super amministratore. */
export function ruoliInvitabili(isSuperAdmin: boolean): RuoloInvitabile[] {
  return isSuperAdmin ? ['CONDOMINO', 'PORTIERE', 'ADMIN'] : ['CONDOMINO', 'PORTIERE'];
}

export function etichettaUnita(palazzo: string, interno: string): string {
  return `${palazzo} · interno ${interno}`;
}

/** Messaggio da mostrare a chi ha provato a invitare: testi nostri, mai quelli grezzi del server. */
export function messaggioErroreInvito(codice: string | null): string {
  switch (codice) {
    case '400':
      return 'I dati dell’invito non sono validi. Controlla email, ruolo e unità e riprova.';
    case '403':
      return 'Non puoi invitare persone in questo condominio.';
    case '429':
      return 'Hai mandato molti inviti in poco tempo. Riprova tra qualche minuto.';
    case '502':
      return 'L’invito è stato registrato, ma non siamo riusciti a spedire l’email. Riprova tra poco.';
    case '500':
      return 'Il servizio non risponde in questo momento. Riprova tra qualche minuto.';
    default:
      return 'Non riusciamo a collegarci. Controlla la connessione a internet e riprova.';
  }
}

/** Identica per chi ha già un account e per chi no: non si rivela chi è già registrato. */
export const INVITO_REGISTRATO_MESSAGE = 'Invito registrato.';
