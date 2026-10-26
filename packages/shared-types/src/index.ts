/* eslint-disable */
/**
 * FILE GENERATO – NON MODIFICARE A MANO.
 * Sorgente: supabase/migrations/01_init_schema.sql   |   Rigenera con: npm run gen:types
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ============================== Interfacce di riga (Row) ==============================
export interface IUtente {
  id: string;
  email: string | null;
  nome_cognome: string | null;
  telefono: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface IPianoAbbonamento {
  id: string;
  nome: string;
  prezzo_mensile: number;
  limite_unita: number | null;
  feature_premium: Json;
  created_at: string;
  updated_at: string;
}

export interface ILicenzaSaas {
  id: string;
  admin_id: string;
  piano_id: string;
  is_active: boolean;
  data_scadenza: string | null;
  created_at: string;
  updated_at: string;
}

export interface IFatturaSaas {
  id: string;
  admin_id: string;
  importo: number;
  url_pdf: string | null;
  data_emissione: string;
}

export interface IRuoloPiattaforma {
  id: string;
  codice: 'CONDOMINO' | 'ADMIN' | 'PORTIERE';
}

export interface IUtenteEntitaRuolo {
  id: string;
  utente_id: string;
  ruolo_id: string;
  condominio_id: string | null;
  unita_id: string | null;
  created_at: string;
}

export interface IAuditLog {
  id: string;
  utente_id: string | null;
  azione: string;
  tabella: string | null;
  record_id: string | null;
  timestamp: string;
  ip_address: string | null;
}

export interface ICondominio {
  id: string;
  admin_id: string;
  nome: string;
  tipo: 'CONDOMINIO' | 'SUPERCONDOMINIO';
  codice_fiscale: string | null;
  partita_iva: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  iban_principale: string | null;
  created_at: string;
  updated_at: string;
}

export interface IPalazzo {
  id: string;
  condominio_id: string;
  nome_identificativo: string;
  indirizzo: string | null;
  created_at: string;
  updated_at: string;
}

export interface IConfigurazioneCondominio {
  id: string;
  condominio_id: string;
  palazzo_id: string | null;
  abilita_social: boolean;
  abilita_chat: boolean;
  abilita_bacheca: boolean;
  abilita_ticket: boolean;
  abilita_prenotazioni: boolean;
  abilita_pacchi: boolean;
  updated_at: string;
}

export interface IScalaColonna {
  id: string;
  palazzo_id: string;
  tipo: 'SCALA' | 'COLONNA';
  nome: string;
}

export interface ITipologiaUnita {
  id: string;
  descrizione: string;
}

export interface IUnitaImmobiliare {
  id: string;
  palazzo_id: string;
  scala_colonna_id: string | null;
  tipologia_id: string;
  interno: string;
  piano: number | null;
  mq: number | null;
  foglio_catastale: string | null;
  particella: string | null;
  subalterno: string | null;
  created_at: string;
  updated_at: string;
}

export interface IAnagraficaUnita {
  id: string;
  unita_id: string;
  utente_id: string;
  data_inizio: string;
  data_fine: string | null;
  tipo_possesso: 'PROPRIETARIO' | 'INQUILINO';
  quota_possesso: number;
  created_at: string;
  updated_at: string;
}

export interface IInvitoPendenti {
  token: string;
  email: string;
  ruolo_proposto: string;
  flag_portiere: boolean;
  condominio_id: string;
  unita_id: string | null;
  invitato_da: string | null;
  scadenza: string;
  accettato_at: string | null;
}

export interface IDispositivoPush {
  id: string;
  utente_id: string;
  token: string;
  piattaforma: 'IOS' | 'ANDROID' | 'WEB';
  created_at: string;
}

export interface INotifica {
  id: string;
  utente_id: string;
  condominio_id: string | null;
  titolo: string;
  corpo: string | null;
  tipo: string | null;
  riferimento_tabella: string | null;
  riferimento_id: string | null;
  letta: boolean;
  created_at: string;
}

export interface IFornitore {
  id: string;
  admin_id: string;
  ragione_sociale: string;
  p_iva: string | null;
  iban: string | null;
  email: string | null;
  telefono: string | null;
  categoria: string | null;
  created_at: string;
  updated_at: string;
}

export interface ICartellaDocumento {
  id: string;
  condominio_id: string;
  parent_id: string | null;
  nome_cartella: string;
  created_at: string;
}

export interface IDocumentoMetadata {
  id: string;
  cartella_id: string;
  unita_id: string | null;
  url_storage: string;
  nome_file: string;
  tipo_mime: string | null;
  caricato_da: string | null;
  created_at: string;
  updated_at: string;
}

export interface IDocumentoPermesso {
  id: string;
  documento_id: string;
  ruolo_target_id: string | null;
  utente_target_id: string | null;
  tipo_permesso: 'LETTURA' | 'SCRITTURA';
}

export interface IPianoDeiConto {
  id: string;
  condominio_id: string;
  codice: string;
  descrizione_macro: string;
}

export interface ISottoconto {
  id: string;
  piano_conto_id: string;
  descrizione_micro: string;
}

export interface IEsercizioContabile {
  id: string;
  condominio_id: string;
  anno: number;
  data_inizio: string;
  data_fine: string;
  stato: 'PREVENTIVO' | 'CONSUNTIVO' | 'CHIUSO';
  created_at: string;
  updated_at: string;
}

export interface ITabellaMillesimale {
  id: string;
  condominio_id: string;
  palazzo_id: string | null;
  scala_colonna_id: string | null;
  nome: string;
  totale: number;
  created_at: string;
  updated_at: string;
}

export interface IQuotaMillesimale {
  id: string;
  tabella_id: string;
  unita_id: string;
  valore_millesimale: number;
}

export interface IMovimentoContabile {
  id: string;
  esercizio_id: string;
  data: string;
  importo: number;
  segno: '+' | '-';
  sottoconto_id: string | null;
  fornitore_id: string | null;
  descrizione: string | null;
  doc_allegato_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IRataTestata {
  id: string;
  esercizio_id: string;
  tabella_millesimale_id: string | null;
  data_scadenza: string;
  descrizione: string;
  pubblicata: boolean;
  created_at: string;
  updated_at: string;
}

export interface IRataDettaglio {
  id: string;
  rata_testata_id: string;
  unita_id: string;
  utente_id: string | null;
  importo_dovuto: number;
  importo_pagato: number;
  stato: 'DA_PAGARE' | 'PAGATO' | 'RITARDO';
  data_pagamento: string | null;
  bollettino_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ISaldoPregresso {
  id: string;
  esercizio_id: string;
  unita_id: string;
  utente_id: string | null;
  importo: number;
  note: string | null;
  created_at: string;
}

export interface IPagamentoRata {
  id: string;
  rata_dettaglio_id: string;
  utente_id: string | null;
  importo: number;
  metodo: 'SDD' | 'CARTA' | 'PAY_BY_BANK' | 'BONIFICO';
  provider: 'STRIPE' | 'NEXI' | 'MANUALE' | null;
  provider_ref: string | null;
  stato: 'IN_ATTESA' | 'COMPLETATO' | 'FALLITO' | 'RIMBORSATO';
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface ITransazioneBancaria {
  id: string;
  condominio_id: string;
  data_valuta: string;
  importo: number;
  causale: string | null;
  origine: 'CBI' | 'OPEN_BANKING' | 'MANUALE';
  hash_movimento: string | null;
  stato_riconciliazione: 'NON_RICONCILIATA' | 'PARZIALE' | 'RICONCILIATA' | 'IGNORATA';
  created_at: string;
  updated_at: string;
}

export interface IRiconciliazioneLog {
  id: string;
  transazione_id: string;
  rata_dettaglio_id: string;
  importo_assegnato: number | null;
  metodo: 'AUTO' | 'MANUALE';
  data_matching: string;
}

export interface ISollecitoMorosita {
  id: string;
  unita_id: string;
  utente_id: string | null;
  rata_dettaglio_id: string | null;
  data_invio: string;
  livello_gravita: number;
  url_pdf_lettera: string | null;
}

export interface IPolizzaAssicurativa {
  id: string;
  condominio_id: string;
  compagnia: string;
  numero_polizza: string | null;
  premio_annuo: number | null;
  data_scadenza: string;
  doc_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ICategoriaGuasto {
  id: string;
  nome: string;
}

export interface ITicketTestata {
  id: string;
  condominio_id: string;
  unita_id: string | null;
  segnalatore_id: string | null;
  categoria_id: string | null;
  titolo: string;
  descrizione: string | null;
  is_area_comune: boolean;
  priorita: 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  stato: 'APERTO' | 'LAVORAZIONE' | 'RISOLTO';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface ITicketMessaggio {
  id: string;
  ticket_id: string;
  mittente_id: string | null;
  messaggio: string;
  timestamp: string;
}

export interface ITicketAllegato {
  id: string;
  ticket_id: string;
  url_storage: string;
  tipo_file: 'FOTO' | 'FATTURA' | 'ALTRO';
  caricato_da: string | null;
  created_at: string;
}

export interface ITicketIntervento {
  id: string;
  ticket_id: string;
  fornitore_id: string;
  data_prevista: string | null;
  importo_consuntivo: number | null;
  note_fornitore: string | null;
  fattura_url: string | null;
  foto_lavoro_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface IFornitoreToken {
  token: string;
  ticket_intervento_id: string;
  url_magico: string | null;
  data_scadenza: string;
  used_at: string | null;
}

export interface IBachecaPost {
  id: string;
  condominio_id: string;
  palazzo_id: string | null;
  autore_id: string | null;
  titolo: string;
  corpo: string | null;
  is_pinned: boolean;
  data_pubblicazione: string;
  updated_at: string;
}

export interface IBachecaCommento {
  id: string;
  post_id: string;
  autore_id: string | null;
  commento: string;
  created_at: string;
}

export interface ISondaggio {
  id: string;
  condominio_id: string;
  autore_id: string | null;
  domanda: string;
  data_chiusura: string | null;
  created_at: string;
}

export interface ISondaggioOpzione {
  id: string;
  sondaggio_id: string;
  testo: string;
}

export interface ISondaggioVoto {
  id: string;
  opzione_id: string;
  sondaggio_id: string;
  utente_id: string;
  created_at: string;
}

export interface IChatRoom {
  id: string;
  condominio_id: string;
  palazzo_id: string | null;
  nome_stanza: string;
  tipo: 'GENERALE' | 'PALAZZO';
  created_at: string;
}

export interface IChatPartecipante {
  room_id: string;
  utente_id: string;
  joined_at: string;
}

export interface IChatMessaggio {
  id: string;
  room_id: string;
  mittente_id: string | null;
  testo_messaggio: string;
  timestamp: string;
}

export interface IEventoCalendario {
  id: string;
  condominio_id: string;
  palazzo_id: string | null;
  titolo: string;
  descrizione: string | null;
  data_inizio: string;
  data_fine: string | null;
  creato_da: string | null;
  created_at: string;
  updated_at: string;
}

export interface IRaccoltaDifferenziata {
  id: string;
  condominio_id: string;
  tipo_rifiuto: string;
  giorno_settimana: number;
  note: string | null;
}

export interface IAssembleaTestata {
  id: string;
  condominio_id: string;
  tabella_millesimale_id: string | null;
  data: string;
  luogo: string | null;
  link_meet: string | null;
  verbale_url: string | null;
  stato: 'BOZZA' | 'CONVOCATA' | 'IN_CORSO' | 'CONCLUSA' | 'ANNULLATA';
  tipo: 'ORDINARIA' | 'STRAORDINARIA';
  modalita: 'PRESENZA' | 'ONLINE' | 'IBRIDA';
  created_at: string;
  updated_at: string;
}

export interface IAssembleaPuntoOdg {
  id: string;
  assemblea_id: string;
  ordine: number;
  titolo_punto: string;
  descrizione: string | null;
  votazione_aperta: boolean;
}

export interface IAssembleaVoto {
  id: string;
  punto_odg_id: string;
  unita_id: string;
  utente_id: string | null;
  voto: 'FAVOREVOLE' | 'CONTRARIO' | 'ASTENUTO';
  created_at: string;
}

export interface IRegistroPacco {
  id: string;
  condominio_id: string;
  unita_destinazione_id: string;
  registrato_da: string | null;
  mittente_esterno: string | null;
  stato: 'GIACENZA' | 'RITIRATO';
  data_arrivo: string;
  data_ritiro: string | null;
  firma_ritiro: string | null;
}

export interface IRisorsaPrenotabile {
  id: string;
  condominio_id: string;
  nome: string;
  tariffa_oraria: number;
  max_ore: number | null;
  created_at: string;
  updated_at: string;
}

export interface IPrenotazioneSpazio {
  id: string;
  risorsa_id: string;
  utente_id: string;
  data_inizio: string;
  data_fine: string;
  costo_addebitato: number;
  created_at: string;
}

export interface ILogStoricoImmobile {
  id: string;
  unita_id: string;
  tipo_evento: string;
  descrizione: string | null;
  visibilita: 'PUBBLICO' | 'RISERVATO';
  data_evento: string;
}

export interface IF24Generato {
  id: string;
  condominio_id: string;
  codici_tributo: string[];
  importo_totale: number;
  data_scadenza: string;
  stato_invio: 'DA_INVIARE' | 'INVIATO' | 'ERRORE';
  created_at: string;
}

export interface IFatturaSdiInbound {
  id: string;
  condominio_id: string;
  piva_fornitore: string;
  xml_raw: string | null;
  importo_tot: number | null;
  stato_prima_nota: 'DA_REGISTRARE' | 'REGISTRATA' | 'SCARTATA';
  created_at: string;
}

export interface IAssembleaPresenza {
  id: string;
  assemblea_id: string;
  unita_id: string;
  utente_id: string | null;
  delegato_utente_id: string | null;
  modalita_presenza: 'PRESENZA' | 'ONLINE' | 'DELEGA';
  check_in_at: string;
}

export interface ISinistroAssicurativo {
  id: string;
  condominio_id: string;
  polizza_id: string;
  ticket_id: string | null;
  numero_pratica: string | null;
  descrizione: string;
  importo_stimato: number | null;
  importo_liquidato: number | null;
  stato: 'APERTO' | 'PERIZIA' | 'LIQUIDATO' | 'RESPINTO' | 'CHIUSO';
  data_apertura: string;
  created_at: string;
  updated_at: string;
}

export interface IPianoRateizzazione {
  id: string;
  condominio_id: string;
  unita_id: string;
  utente_id: string;
  importo_totale: number;
  numero_rate: number;
  stato: 'RICHIESTO' | 'ATTIVO' | 'COMPLETATO' | 'REVOCATO';
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface IImportJob {
  id: string;
  condominio_id: string;
  eseguito_da: string | null;
  tipo_import: 'ANAGRAFICHE' | 'MILLESIMI' | 'SALDI_PREGRESSI';
  nome_file: string;
  righe_totali: number;
  righe_importate: number;
  stato: 'IN_CORSO' | 'COMPLETATO' | 'ERRORE';
  dettaglio_errori: Json;
  created_at: string;
}

// ============================== Database (formato supabase-js) ==============================
/** Converte un'interfaccia in type-alias (richiesto da supabase-js: niente index-signature mancante). */
type Plain<T> = { [K in keyof T]: T[K] };

export interface Database {
  public: {
    Tables: {
      utenti: {
        Row: Plain<IUtente>;
        Insert: Plain<Omit<IUtente, 'email' | 'nome_cognome' | 'telefono' | 'avatar_url' | 'is_superadmin' | 'created_at' | 'updated_at'> & Partial<Pick<IUtente, 'email' | 'nome_cognome' | 'telefono' | 'avatar_url' | 'is_superadmin' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IUtente>>;
        Relationships: [];
      };
      piani_abbonamento: {
        Row: Plain<IPianoAbbonamento>;
        Insert: Plain<Omit<IPianoAbbonamento, 'id' | 'limite_unita' | 'feature_premium' | 'created_at' | 'updated_at'> & Partial<Pick<IPianoAbbonamento, 'id' | 'limite_unita' | 'feature_premium' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IPianoAbbonamento>>;
        Relationships: [];
      };
      licenze_saas: {
        Row: Plain<ILicenzaSaas>;
        Insert: Plain<Omit<ILicenzaSaas, 'id' | 'is_active' | 'data_scadenza' | 'created_at' | 'updated_at'> & Partial<Pick<ILicenzaSaas, 'id' | 'is_active' | 'data_scadenza' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<ILicenzaSaas>>;
        Relationships: [];
      };
      fatture_saas: {
        Row: Plain<IFatturaSaas>;
        Insert: Plain<Omit<IFatturaSaas, 'id' | 'url_pdf' | 'data_emissione'> & Partial<Pick<IFatturaSaas, 'id' | 'url_pdf' | 'data_emissione'>>>;
        Update: Plain<Partial<IFatturaSaas>>;
        Relationships: [];
      };
      ruoli_piattaforma: {
        Row: Plain<IRuoloPiattaforma>;
        Insert: Plain<Omit<IRuoloPiattaforma, 'id'> & Partial<Pick<IRuoloPiattaforma, 'id'>>>;
        Update: Plain<Partial<IRuoloPiattaforma>>;
        Relationships: [];
      };
      utente_entita_ruolo: {
        Row: Plain<IUtenteEntitaRuolo>;
        Insert: Plain<Omit<IUtenteEntitaRuolo, 'id' | 'condominio_id' | 'unita_id' | 'created_at'> & Partial<Pick<IUtenteEntitaRuolo, 'id' | 'condominio_id' | 'unita_id' | 'created_at'>>>;
        Update: Plain<Partial<IUtenteEntitaRuolo>>;
        Relationships: [];
      };
      audit_logs: {
        Row: Plain<IAuditLog>;
        Insert: Plain<Omit<IAuditLog, 'id' | 'utente_id' | 'tabella' | 'record_id' | 'timestamp' | 'ip_address'> & Partial<Pick<IAuditLog, 'id' | 'utente_id' | 'tabella' | 'record_id' | 'timestamp' | 'ip_address'>>>;
        Update: Plain<Partial<IAuditLog>>;
        Relationships: [];
      };
      condomini: {
        Row: Plain<ICondominio>;
        Insert: Plain<Omit<ICondominio, 'id' | 'tipo' | 'codice_fiscale' | 'partita_iva' | 'indirizzo' | 'citta' | 'cap' | 'provincia' | 'iban_principale' | 'created_at' | 'updated_at'> & Partial<Pick<ICondominio, 'id' | 'tipo' | 'codice_fiscale' | 'partita_iva' | 'indirizzo' | 'citta' | 'cap' | 'provincia' | 'iban_principale' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<ICondominio>>;
        Relationships: [];
      };
      palazzi: {
        Row: Plain<IPalazzo>;
        Insert: Plain<Omit<IPalazzo, 'id' | 'indirizzo' | 'created_at' | 'updated_at'> & Partial<Pick<IPalazzo, 'id' | 'indirizzo' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IPalazzo>>;
        Relationships: [];
      };
      configurazioni_condominio: {
        Row: Plain<IConfigurazioneCondominio>;
        Insert: Plain<Omit<IConfigurazioneCondominio, 'id' | 'palazzo_id' | 'abilita_social' | 'abilita_chat' | 'abilita_bacheca' | 'abilita_ticket' | 'abilita_prenotazioni' | 'abilita_pacchi' | 'updated_at'> & Partial<Pick<IConfigurazioneCondominio, 'id' | 'palazzo_id' | 'abilita_social' | 'abilita_chat' | 'abilita_bacheca' | 'abilita_ticket' | 'abilita_prenotazioni' | 'abilita_pacchi' | 'updated_at'>>>;
        Update: Plain<Partial<IConfigurazioneCondominio>>;
        Relationships: [];
      };
      scale_colonne: {
        Row: Plain<IScalaColonna>;
        Insert: Plain<Omit<IScalaColonna, 'id'> & Partial<Pick<IScalaColonna, 'id'>>>;
        Update: Plain<Partial<IScalaColonna>>;
        Relationships: [];
      };
      tipologie_unita: {
        Row: Plain<ITipologiaUnita>;
        Insert: Plain<Omit<ITipologiaUnita, 'id'> & Partial<Pick<ITipologiaUnita, 'id'>>>;
        Update: Plain<Partial<ITipologiaUnita>>;
        Relationships: [];
      };
      unita_immobiliari: {
        Row: Plain<IUnitaImmobiliare>;
        Insert: Plain<Omit<IUnitaImmobiliare, 'id' | 'scala_colonna_id' | 'piano' | 'mq' | 'foglio_catastale' | 'particella' | 'subalterno' | 'created_at' | 'updated_at'> & Partial<Pick<IUnitaImmobiliare, 'id' | 'scala_colonna_id' | 'piano' | 'mq' | 'foglio_catastale' | 'particella' | 'subalterno' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IUnitaImmobiliare>>;
        Relationships: [];
      };
      anagrafiche_unita: {
        Row: Plain<IAnagraficaUnita>;
        Insert: Plain<Omit<IAnagraficaUnita, 'id' | 'data_inizio' | 'data_fine' | 'quota_possesso' | 'created_at' | 'updated_at'> & Partial<Pick<IAnagraficaUnita, 'id' | 'data_inizio' | 'data_fine' | 'quota_possesso' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IAnagraficaUnita>>;
        Relationships: [];
      };
      inviti_pendenti: {
        Row: Plain<IInvitoPendenti>;
        Insert: Plain<Omit<IInvitoPendenti, 'token' | 'flag_portiere' | 'unita_id' | 'invitato_da' | 'scadenza' | 'accettato_at'> & Partial<Pick<IInvitoPendenti, 'token' | 'flag_portiere' | 'unita_id' | 'invitato_da' | 'scadenza' | 'accettato_at'>>>;
        Update: Plain<Partial<IInvitoPendenti>>;
        Relationships: [];
      };
      dispositivi_push: {
        Row: Plain<IDispositivoPush>;
        Insert: Plain<Omit<IDispositivoPush, 'id' | 'created_at'> & Partial<Pick<IDispositivoPush, 'id' | 'created_at'>>>;
        Update: Plain<Partial<IDispositivoPush>>;
        Relationships: [];
      };
      notifiche: {
        Row: Plain<INotifica>;
        Insert: Plain<Omit<INotifica, 'id' | 'condominio_id' | 'corpo' | 'tipo' | 'riferimento_tabella' | 'riferimento_id' | 'letta' | 'created_at'> & Partial<Pick<INotifica, 'id' | 'condominio_id' | 'corpo' | 'tipo' | 'riferimento_tabella' | 'riferimento_id' | 'letta' | 'created_at'>>>;
        Update: Plain<Partial<INotifica>>;
        Relationships: [];
      };
      fornitori: {
        Row: Plain<IFornitore>;
        Insert: Plain<Omit<IFornitore, 'id' | 'p_iva' | 'iban' | 'email' | 'telefono' | 'categoria' | 'created_at' | 'updated_at'> & Partial<Pick<IFornitore, 'id' | 'p_iva' | 'iban' | 'email' | 'telefono' | 'categoria' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IFornitore>>;
        Relationships: [];
      };
      cartelle_documenti: {
        Row: Plain<ICartellaDocumento>;
        Insert: Plain<Omit<ICartellaDocumento, 'id' | 'parent_id' | 'created_at'> & Partial<Pick<ICartellaDocumento, 'id' | 'parent_id' | 'created_at'>>>;
        Update: Plain<Partial<ICartellaDocumento>>;
        Relationships: [];
      };
      documenti_metadata: {
        Row: Plain<IDocumentoMetadata>;
        Insert: Plain<Omit<IDocumentoMetadata, 'id' | 'unita_id' | 'tipo_mime' | 'caricato_da' | 'created_at' | 'updated_at'> & Partial<Pick<IDocumentoMetadata, 'id' | 'unita_id' | 'tipo_mime' | 'caricato_da' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IDocumentoMetadata>>;
        Relationships: [];
      };
      documenti_permessi: {
        Row: Plain<IDocumentoPermesso>;
        Insert: Plain<Omit<IDocumentoPermesso, 'id' | 'ruolo_target_id' | 'utente_target_id' | 'tipo_permesso'> & Partial<Pick<IDocumentoPermesso, 'id' | 'ruolo_target_id' | 'utente_target_id' | 'tipo_permesso'>>>;
        Update: Plain<Partial<IDocumentoPermesso>>;
        Relationships: [];
      };
      piano_dei_conti: {
        Row: Plain<IPianoDeiConto>;
        Insert: Plain<Omit<IPianoDeiConto, 'id'> & Partial<Pick<IPianoDeiConto, 'id'>>>;
        Update: Plain<Partial<IPianoDeiConto>>;
        Relationships: [];
      };
      sottoconti: {
        Row: Plain<ISottoconto>;
        Insert: Plain<Omit<ISottoconto, 'id'> & Partial<Pick<ISottoconto, 'id'>>>;
        Update: Plain<Partial<ISottoconto>>;
        Relationships: [];
      };
      esercizi_contabili: {
        Row: Plain<IEsercizioContabile>;
        Insert: Plain<Omit<IEsercizioContabile, 'id' | 'stato' | 'created_at' | 'updated_at'> & Partial<Pick<IEsercizioContabile, 'id' | 'stato' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IEsercizioContabile>>;
        Relationships: [];
      };
      tabelle_millesimali: {
        Row: Plain<ITabellaMillesimale>;
        Insert: Plain<Omit<ITabellaMillesimale, 'id' | 'palazzo_id' | 'scala_colonna_id' | 'totale' | 'created_at' | 'updated_at'> & Partial<Pick<ITabellaMillesimale, 'id' | 'palazzo_id' | 'scala_colonna_id' | 'totale' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<ITabellaMillesimale>>;
        Relationships: [];
      };
      quote_millesimali: {
        Row: Plain<IQuotaMillesimale>;
        Insert: Plain<Omit<IQuotaMillesimale, 'id'> & Partial<Pick<IQuotaMillesimale, 'id'>>>;
        Update: Plain<Partial<IQuotaMillesimale>>;
        Relationships: [];
      };
      movimenti_contabili: {
        Row: Plain<IMovimentoContabile>;
        Insert: Plain<Omit<IMovimentoContabile, 'id' | 'sottoconto_id' | 'fornitore_id' | 'descrizione' | 'doc_allegato_id' | 'created_at' | 'updated_at'> & Partial<Pick<IMovimentoContabile, 'id' | 'sottoconto_id' | 'fornitore_id' | 'descrizione' | 'doc_allegato_id' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IMovimentoContabile>>;
        Relationships: [];
      };
      rate_testata: {
        Row: Plain<IRataTestata>;
        Insert: Plain<Omit<IRataTestata, 'id' | 'tabella_millesimale_id' | 'pubblicata' | 'created_at' | 'updated_at'> & Partial<Pick<IRataTestata, 'id' | 'tabella_millesimale_id' | 'pubblicata' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IRataTestata>>;
        Relationships: [];
      };
      rate_dettaglio: {
        Row: Plain<IRataDettaglio>;
        Insert: Plain<Omit<IRataDettaglio, 'id' | 'utente_id' | 'importo_pagato' | 'stato' | 'data_pagamento' | 'bollettino_url' | 'created_at' | 'updated_at'> & Partial<Pick<IRataDettaglio, 'id' | 'utente_id' | 'importo_pagato' | 'stato' | 'data_pagamento' | 'bollettino_url' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IRataDettaglio>>;
        Relationships: [];
      };
      saldi_pregressi: {
        Row: Plain<ISaldoPregresso>;
        Insert: Plain<Omit<ISaldoPregresso, 'id' | 'utente_id' | 'note' | 'created_at'> & Partial<Pick<ISaldoPregresso, 'id' | 'utente_id' | 'note' | 'created_at'>>>;
        Update: Plain<Partial<ISaldoPregresso>>;
        Relationships: [];
      };
      pagamenti_rate: {
        Row: Plain<IPagamentoRata>;
        Insert: Plain<Omit<IPagamentoRata, 'id' | 'utente_id' | 'provider' | 'provider_ref' | 'stato' | 'created_at' | 'completed_at' | 'updated_at'> & Partial<Pick<IPagamentoRata, 'id' | 'utente_id' | 'provider' | 'provider_ref' | 'stato' | 'created_at' | 'completed_at' | 'updated_at'>>>;
        Update: Plain<Partial<IPagamentoRata>>;
        Relationships: [];
      };
      transazioni_bancarie: {
        Row: Plain<ITransazioneBancaria>;
        Insert: Plain<Omit<ITransazioneBancaria, 'id' | 'causale' | 'origine' | 'hash_movimento' | 'stato_riconciliazione' | 'created_at' | 'updated_at'> & Partial<Pick<ITransazioneBancaria, 'id' | 'causale' | 'origine' | 'hash_movimento' | 'stato_riconciliazione' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<ITransazioneBancaria>>;
        Relationships: [];
      };
      riconciliazioni_log: {
        Row: Plain<IRiconciliazioneLog>;
        Insert: Plain<Omit<IRiconciliazioneLog, 'id' | 'importo_assegnato' | 'metodo' | 'data_matching'> & Partial<Pick<IRiconciliazioneLog, 'id' | 'importo_assegnato' | 'metodo' | 'data_matching'>>>;
        Update: Plain<Partial<IRiconciliazioneLog>>;
        Relationships: [];
      };
      solleciti_morosita: {
        Row: Plain<ISollecitoMorosita>;
        Insert: Plain<Omit<ISollecitoMorosita, 'id' | 'utente_id' | 'rata_dettaglio_id' | 'data_invio' | 'livello_gravita' | 'url_pdf_lettera'> & Partial<Pick<ISollecitoMorosita, 'id' | 'utente_id' | 'rata_dettaglio_id' | 'data_invio' | 'livello_gravita' | 'url_pdf_lettera'>>>;
        Update: Plain<Partial<ISollecitoMorosita>>;
        Relationships: [];
      };
      polizze_assicurative: {
        Row: Plain<IPolizzaAssicurativa>;
        Insert: Plain<Omit<IPolizzaAssicurativa, 'id' | 'numero_polizza' | 'premio_annuo' | 'doc_id' | 'created_at' | 'updated_at'> & Partial<Pick<IPolizzaAssicurativa, 'id' | 'numero_polizza' | 'premio_annuo' | 'doc_id' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IPolizzaAssicurativa>>;
        Relationships: [];
      };
      categorie_guasti: {
        Row: Plain<ICategoriaGuasto>;
        Insert: Plain<Omit<ICategoriaGuasto, 'id'> & Partial<Pick<ICategoriaGuasto, 'id'>>>;
        Update: Plain<Partial<ICategoriaGuasto>>;
        Relationships: [];
      };
      ticket_testata: {
        Row: Plain<ITicketTestata>;
        Insert: Plain<Omit<ITicketTestata, 'id' | 'unita_id' | 'segnalatore_id' | 'categoria_id' | 'descrizione' | 'is_area_comune' | 'priorita' | 'stato' | 'created_at' | 'updated_at' | 'closed_at'> & Partial<Pick<ITicketTestata, 'id' | 'unita_id' | 'segnalatore_id' | 'categoria_id' | 'descrizione' | 'is_area_comune' | 'priorita' | 'stato' | 'created_at' | 'updated_at' | 'closed_at'>>>;
        Update: Plain<Partial<ITicketTestata>>;
        Relationships: [];
      };
      ticket_messaggi: {
        Row: Plain<ITicketMessaggio>;
        Insert: Plain<Omit<ITicketMessaggio, 'id' | 'mittente_id' | 'timestamp'> & Partial<Pick<ITicketMessaggio, 'id' | 'mittente_id' | 'timestamp'>>>;
        Update: Plain<Partial<ITicketMessaggio>>;
        Relationships: [];
      };
      ticket_allegati: {
        Row: Plain<ITicketAllegato>;
        Insert: Plain<Omit<ITicketAllegato, 'id' | 'tipo_file' | 'caricato_da' | 'created_at'> & Partial<Pick<ITicketAllegato, 'id' | 'tipo_file' | 'caricato_da' | 'created_at'>>>;
        Update: Plain<Partial<ITicketAllegato>>;
        Relationships: [];
      };
      ticket_interventi: {
        Row: Plain<ITicketIntervento>;
        Insert: Plain<Omit<ITicketIntervento, 'id' | 'data_prevista' | 'importo_consuntivo' | 'note_fornitore' | 'fattura_url' | 'foto_lavoro_url' | 'created_at' | 'updated_at'> & Partial<Pick<ITicketIntervento, 'id' | 'data_prevista' | 'importo_consuntivo' | 'note_fornitore' | 'fattura_url' | 'foto_lavoro_url' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<ITicketIntervento>>;
        Relationships: [];
      };
      fornitori_tokens: {
        Row: Plain<IFornitoreToken>;
        Insert: Plain<Omit<IFornitoreToken, 'url_magico' | 'used_at'> & Partial<Pick<IFornitoreToken, 'url_magico' | 'used_at'>>>;
        Update: Plain<Partial<IFornitoreToken>>;
        Relationships: [];
      };
      bacheca_post: {
        Row: Plain<IBachecaPost>;
        Insert: Plain<Omit<IBachecaPost, 'id' | 'palazzo_id' | 'autore_id' | 'corpo' | 'is_pinned' | 'data_pubblicazione' | 'updated_at'> & Partial<Pick<IBachecaPost, 'id' | 'palazzo_id' | 'autore_id' | 'corpo' | 'is_pinned' | 'data_pubblicazione' | 'updated_at'>>>;
        Update: Plain<Partial<IBachecaPost>>;
        Relationships: [];
      };
      bacheca_commenti: {
        Row: Plain<IBachecaCommento>;
        Insert: Plain<Omit<IBachecaCommento, 'id' | 'autore_id' | 'created_at'> & Partial<Pick<IBachecaCommento, 'id' | 'autore_id' | 'created_at'>>>;
        Update: Plain<Partial<IBachecaCommento>>;
        Relationships: [];
      };
      sondaggi: {
        Row: Plain<ISondaggio>;
        Insert: Plain<Omit<ISondaggio, 'id' | 'autore_id' | 'data_chiusura' | 'created_at'> & Partial<Pick<ISondaggio, 'id' | 'autore_id' | 'data_chiusura' | 'created_at'>>>;
        Update: Plain<Partial<ISondaggio>>;
        Relationships: [];
      };
      sondaggi_opzioni: {
        Row: Plain<ISondaggioOpzione>;
        Insert: Plain<Omit<ISondaggioOpzione, 'id'> & Partial<Pick<ISondaggioOpzione, 'id'>>>;
        Update: Plain<Partial<ISondaggioOpzione>>;
        Relationships: [];
      };
      sondaggi_voti: {
        Row: Plain<ISondaggioVoto>;
        Insert: Plain<Omit<ISondaggioVoto, 'id' | 'created_at'> & Partial<Pick<ISondaggioVoto, 'id' | 'created_at'>>>;
        Update: Plain<Partial<ISondaggioVoto>>;
        Relationships: [];
      };
      chat_rooms: {
        Row: Plain<IChatRoom>;
        Insert: Plain<Omit<IChatRoom, 'id' | 'palazzo_id' | 'tipo' | 'created_at'> & Partial<Pick<IChatRoom, 'id' | 'palazzo_id' | 'tipo' | 'created_at'>>>;
        Update: Plain<Partial<IChatRoom>>;
        Relationships: [];
      };
      chat_partecipanti: {
        Row: Plain<IChatPartecipante>;
        Insert: Plain<Omit<IChatPartecipante, 'joined_at'> & Partial<Pick<IChatPartecipante, 'joined_at'>>>;
        Update: Plain<Partial<IChatPartecipante>>;
        Relationships: [];
      };
      chat_messaggi: {
        Row: Plain<IChatMessaggio>;
        Insert: Plain<Omit<IChatMessaggio, 'id' | 'mittente_id' | 'timestamp'> & Partial<Pick<IChatMessaggio, 'id' | 'mittente_id' | 'timestamp'>>>;
        Update: Plain<Partial<IChatMessaggio>>;
        Relationships: [];
      };
      eventi_calendario: {
        Row: Plain<IEventoCalendario>;
        Insert: Plain<Omit<IEventoCalendario, 'id' | 'palazzo_id' | 'descrizione' | 'data_fine' | 'creato_da' | 'created_at' | 'updated_at'> & Partial<Pick<IEventoCalendario, 'id' | 'palazzo_id' | 'descrizione' | 'data_fine' | 'creato_da' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IEventoCalendario>>;
        Relationships: [];
      };
      raccolta_differenziata: {
        Row: Plain<IRaccoltaDifferenziata>;
        Insert: Plain<Omit<IRaccoltaDifferenziata, 'id' | 'note'> & Partial<Pick<IRaccoltaDifferenziata, 'id' | 'note'>>>;
        Update: Plain<Partial<IRaccoltaDifferenziata>>;
        Relationships: [];
      };
      assemblee_testata: {
        Row: Plain<IAssembleaTestata>;
        Insert: Plain<Omit<IAssembleaTestata, 'id' | 'tabella_millesimale_id' | 'luogo' | 'link_meet' | 'verbale_url' | 'stato' | 'tipo' | 'modalita' | 'created_at' | 'updated_at'> & Partial<Pick<IAssembleaTestata, 'id' | 'tabella_millesimale_id' | 'luogo' | 'link_meet' | 'verbale_url' | 'stato' | 'tipo' | 'modalita' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IAssembleaTestata>>;
        Relationships: [];
      };
      assemblee_punti_odg: {
        Row: Plain<IAssembleaPuntoOdg>;
        Insert: Plain<Omit<IAssembleaPuntoOdg, 'id' | 'ordine' | 'descrizione' | 'votazione_aperta'> & Partial<Pick<IAssembleaPuntoOdg, 'id' | 'ordine' | 'descrizione' | 'votazione_aperta'>>>;
        Update: Plain<Partial<IAssembleaPuntoOdg>>;
        Relationships: [];
      };
      assemblee_voti: {
        Row: Plain<IAssembleaVoto>;
        Insert: Plain<Omit<IAssembleaVoto, 'id' | 'utente_id' | 'created_at'> & Partial<Pick<IAssembleaVoto, 'id' | 'utente_id' | 'created_at'>>>;
        Update: Plain<Partial<IAssembleaVoto>>;
        Relationships: [];
      };
      registro_pacchi: {
        Row: Plain<IRegistroPacco>;
        Insert: Plain<Omit<IRegistroPacco, 'id' | 'registrato_da' | 'mittente_esterno' | 'stato' | 'data_arrivo' | 'data_ritiro' | 'firma_ritiro'> & Partial<Pick<IRegistroPacco, 'id' | 'registrato_da' | 'mittente_esterno' | 'stato' | 'data_arrivo' | 'data_ritiro' | 'firma_ritiro'>>>;
        Update: Plain<Partial<IRegistroPacco>>;
        Relationships: [];
      };
      risorse_prenotabili: {
        Row: Plain<IRisorsaPrenotabile>;
        Insert: Plain<Omit<IRisorsaPrenotabile, 'id' | 'tariffa_oraria' | 'max_ore' | 'created_at' | 'updated_at'> & Partial<Pick<IRisorsaPrenotabile, 'id' | 'tariffa_oraria' | 'max_ore' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IRisorsaPrenotabile>>;
        Relationships: [];
      };
      prenotazioni_spazi: {
        Row: Plain<IPrenotazioneSpazio>;
        Insert: Plain<Omit<IPrenotazioneSpazio, 'id' | 'costo_addebitato' | 'created_at'> & Partial<Pick<IPrenotazioneSpazio, 'id' | 'costo_addebitato' | 'created_at'>>>;
        Update: Plain<Partial<IPrenotazioneSpazio>>;
        Relationships: [];
      };
      log_storico_immobile: {
        Row: Plain<ILogStoricoImmobile>;
        Insert: Plain<Omit<ILogStoricoImmobile, 'id' | 'descrizione' | 'visibilita' | 'data_evento'> & Partial<Pick<ILogStoricoImmobile, 'id' | 'descrizione' | 'visibilita' | 'data_evento'>>>;
        Update: Plain<Partial<ILogStoricoImmobile>>;
        Relationships: [];
      };
      f24_generati: {
        Row: Plain<IF24Generato>;
        Insert: Plain<Omit<IF24Generato, 'id' | 'codici_tributo' | 'stato_invio' | 'created_at'> & Partial<Pick<IF24Generato, 'id' | 'codici_tributo' | 'stato_invio' | 'created_at'>>>;
        Update: Plain<Partial<IF24Generato>>;
        Relationships: [];
      };
      fatture_sdi_inbound: {
        Row: Plain<IFatturaSdiInbound>;
        Insert: Plain<Omit<IFatturaSdiInbound, 'id' | 'xml_raw' | 'importo_tot' | 'stato_prima_nota' | 'created_at'> & Partial<Pick<IFatturaSdiInbound, 'id' | 'xml_raw' | 'importo_tot' | 'stato_prima_nota' | 'created_at'>>>;
        Update: Plain<Partial<IFatturaSdiInbound>>;
        Relationships: [];
      };
      assemblee_presenze: {
        Row: Plain<IAssembleaPresenza>;
        Insert: Plain<Omit<IAssembleaPresenza, 'id' | 'utente_id' | 'delegato_utente_id' | 'modalita_presenza' | 'check_in_at'> & Partial<Pick<IAssembleaPresenza, 'id' | 'utente_id' | 'delegato_utente_id' | 'modalita_presenza' | 'check_in_at'>>>;
        Update: Plain<Partial<IAssembleaPresenza>>;
        Relationships: [];
      };
      sinistri_assicurativi: {
        Row: Plain<ISinistroAssicurativo>;
        Insert: Plain<Omit<ISinistroAssicurativo, 'id' | 'ticket_id' | 'numero_pratica' | 'importo_stimato' | 'importo_liquidato' | 'stato' | 'data_apertura' | 'created_at' | 'updated_at'> & Partial<Pick<ISinistroAssicurativo, 'id' | 'ticket_id' | 'numero_pratica' | 'importo_stimato' | 'importo_liquidato' | 'stato' | 'data_apertura' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<ISinistroAssicurativo>>;
        Relationships: [];
      };
      piani_rateizzazione: {
        Row: Plain<IPianoRateizzazione>;
        Insert: Plain<Omit<IPianoRateizzazione, 'id' | 'numero_rate' | 'stato' | 'note' | 'created_at' | 'updated_at'> & Partial<Pick<IPianoRateizzazione, 'id' | 'numero_rate' | 'stato' | 'note' | 'created_at' | 'updated_at'>>>;
        Update: Plain<Partial<IPianoRateizzazione>>;
        Relationships: [];
      };
      import_jobs: {
        Row: Plain<IImportJob>;
        Insert: Plain<Omit<IImportJob, 'id' | 'eseguito_da' | 'righe_totali' | 'righe_importate' | 'stato' | 'dettaglio_errori' | 'created_at'> & Partial<Pick<IImportJob, 'id' | 'eseguito_da' | 'righe_totali' | 'righe_importate' | 'stato' | 'dettaglio_errori' | 'created_at'>>>;
        Update: Plain<Partial<IImportJob>>;
        Relationships: [];
      };
    };
    Views: {
      profili_pubblici: {
        Row: {
          id: string | null;
          nome_cognome: string | null;
          avatar_url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_superadmin: { Args: Record<string, never>; Returns: boolean };
      is_admin_of: { Args: { p_cond: string }; Returns: boolean };
      has_cond_access: { Args: { p_cond: string }; Returns: boolean };
      has_role_in: { Args: { p_cond: string; p_codice: string }; Returns: boolean };
      has_unita_access: { Args: { p_unita: string }; Returns: boolean };
      can_read_documento: { Args: { p_doc: string }; Returns: boolean };
      risultati_voto: {
        Args: { p_punto: string };
        Returns: {
          voto: string;
          n_voti: number;
          millesimi: number;
          percentuale_teste: number;
          percentuale_millesimi: number;
        }[];
      };
      quorum_assemblea: {
        Args: { p_assemblea: string };
        Returns: {
          presenti_teste: number;
          totale_unita: number;
          presenti_millesimi: number;
          totale_millesimi: number;
          quorum_seconda_convocazione: boolean;
        }[];
      };
      pagamento_completato: {
        Args: {
          p_provider_ref: string;
          p_importo: number;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// ============================== Helper generici ==============================
export type TableName = keyof Database['public']['Tables'];
export type ViewName = keyof Database['public']['Views'];
export type Tables<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends TableName> = Database['public']['Tables'][T]['Update'];
export type Views<T extends ViewName> = Database['public']['Views'][T]['Row'];

// ============================== Alias di dominio ==============================
export type IRata = IRataDettaglio;
export type ITicket = ITicketTestata;
export type IChatMessage = IChatMessaggio;
export type IUnita = IUnitaImmobiliare;
export type IAssemblea = IAssembleaTestata;
export type IProfiloPubblico = Database['public']['Views']['profili_pubblici']['Row'];

export type RuoloCodice = 'CONDOMINO' | 'ADMIN' | 'PORTIERE';
