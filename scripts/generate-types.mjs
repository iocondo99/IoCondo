#!/usr/bin/env node
/**
 * Genera packages/shared-types/src/index.ts a partire da:
 *   - supabase/migrations/01_init_schema.sql
 *   - supabase/da-applicare/10_contabilita_schema_modello_obiettivo.sql
 * Uso: npm run gen:types
 *
 * - Una interfaccia `I<Nome>` per ogni tabella (Row).
 * - Il tipo `Database` (formato supabase-js) con Row / Insert / Update per ogni tabella.
 * - I CHECK (col IN ('A','B')) diventano union di stringhe letterali.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sqlFiles = [
  resolve(root, 'supabase/migrations/01_init_schema.sql'),
  resolve(root, 'supabase/da-applicare/10_contabilita_schema_modello_obiettivo.sql'),
];
const outPath = resolve(root, 'packages/shared-types/src/index.ts');

const sql = sqlFiles
  .filter((p) => existsSync(p))
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n')
  .split(/\r?\n/)
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

// ---- singolarizzazione dei nomi (it) per i nomi delle interfacce -------------------------------
const SING = {
  utenti: 'Utente', piani: 'Piano', licenze: 'Licenza', fatture: 'Fattura', ruoli: 'Ruolo', inviti: 'Invito',
  condomini: 'Condominio', palazzi: 'Palazzo', scale: 'Scala', colonne: 'Colonna', tipologie: 'Tipologia',
  immobiliari: 'Immobiliare', anagrafiche: 'Anagrafica', dispositivi: 'Dispositivo', notifiche: 'Notifica',
  fornitori: 'Fornitore', cartelle: 'Cartella', documenti: 'Documento', permessi: 'Permesso', conti: 'Conto',
  sottoconti: 'Sottoconto', esercizi: 'Esercizio', contabili: 'Contabile', tabelle: 'Tabella',
  millesimali: 'Millesimale', quote: 'Quota', movimenti: 'Movimento', rate: 'Rata', saldi: 'Saldo',
  pregressi: 'Pregresso', pagamenti: 'Pagamento', transazioni: 'Transazione', bancarie: 'Bancaria',
  riconciliazioni: 'Riconciliazione', solleciti: 'Sollecito', polizze: 'Polizza', assicurative: 'Assicurativa',
  categorie: 'Categoria', guasti: 'Guasto', messaggi: 'Messaggio', allegati: 'Allegato',
  interventi: 'Intervento', commenti: 'Commento', sondaggi: 'Sondaggio', opzioni: 'Opzione', voti: 'Voto',
  partecipanti: 'Partecipante', eventi: 'Evento', assemblee: 'Assemblea', punti: 'Punto', pacchi: 'Pacco',
  risorse: 'Risorsa', prenotabili: 'Prenotabile', prenotazioni: 'Prenotazione', spazi: 'Spazio',
  generati: 'Generato', configurazioni: 'Configurazione', logs: 'Log', rooms: 'Room', tokens: 'Token',
  sinistri: 'Sinistro', assicurativi: 'Assicurativo', presenze: 'Presenza', jobs: 'Job',
  // Modulo contabile (Passo 0 - Modello Obiettivo)
  migrazioni: 'Migrazione', contabilita: 'Contabilita', soggetti: 'Soggetto',
  assegnazioni: 'Assegnazione', amministratore: 'Amministratore', voci: 'Voce', spesa: 'Spesa',
  catalogo: 'Catalogo', fondi: 'Fondo', fondo: 'Fondo', gestioni: 'Gestione', esercizio: 'Esercizio',
  preventivi: 'Preventivo', riparti: 'Riparto', spese: 'Spesa', letture: 'Lettura', contatori: 'Contatore',
  bollettini: 'Bollettino', righe: 'Riga', scadenziario: 'Scadenziario', recupero: 'Recupero',
  crediti: 'Credito', conguagli: 'Conguaglio', unita: 'Unita',
};
const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ifaceName = (table) => 'I' + table.split('_').map((p) => SING[p] ?? pascal(p)).join('');

// ---- parsing ------------------------------------------------------------------------------------
function splitTopLevel(body) {
  const parts = [];
  let depth = 0, cur = '', inStr = false;
  for (const ch of body) {
    if (ch === "'") inStr = !inStr;
    if (!inStr) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function tsType(pgType, enumVals) {
  if (enumVals) return enumVals.map((v) => `'${v}'`).join(' | ');
  const t = pgType.toLowerCase();
  if (t.endsWith('[]')) return `${tsType(t.slice(0, -2))}[]`;
  if (/^(numeric|integer|int|smallint|bigint|real|double)/.test(t)) return 'number';
  if (t.startsWith('boolean')) return 'boolean';
  if (t.startsWith('jsonb') || t.startsWith('json')) return 'Json';
  return 'string'; // uuid, text, char, varchar, date, timestamptz, inet
}

function parseColumnDef(item) {
  if (/^(unique|check|constraint|exclude|primary|foreign)\b/i.test(item)) return null;
  const cm = item.match(/^("?\w+"?)\s+([\w]+(?:\s*\([^)]*\))?(?:\[\])?)/);
  if (!cm) return null;
  const col = cm[1].replace(/"/g, '');
  const pgType = cm[2].replace(/\s+/g, '');
  const enumM = item.match(/check\s*\(\s*"?\w+"?\s+in\s*\(([^)]*)\)\s*\)/i);
  const enumVals = enumM ? [...enumM[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : null;
  const notNull = /not\s+null/i.test(item) || /primary\s+key/i.test(item);
  const hasDefault = /\bdefault\b/i.test(item);
  return { col, ts: tsType(pgType, enumVals), nullable: !notNull, hasDefault };
}

const tables = [];
const tableMap = new Map();

// 1. CREATE TABLE [IF NOT EXISTS]
const reCreate = /create table (?:if not exists\s+)?(?:public\.)?(\w+)\s*\(/gi;
let m;
while ((m = reCreate.exec(sql))) {
  const name = m[1];
  let i = reCreate.lastIndex, depth = 1;
  while (depth > 0 && i < sql.length) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') depth--;
    i++;
  }
  const body = sql.slice(reCreate.lastIndex, i - 1);
  const columns = [];
  for (const item of splitTopLevel(body)) {
    const parsed = parseColumnDef(item);
    if (parsed) columns.push(parsed);
  }
  const entry = { name, iface: ifaceName(name), columns };
  tables.push(entry);
  tableMap.set(name, entry);
}

// 2. ALTER TABLE ... ADD COLUMN [IF NOT EXISTS]
const reAlter = /alter table (?:only\s+)?(?:public\.)?(\w+)\s+([\s\S]*?);/gi;
while ((m = reAlter.exec(sql))) {
  const name = m[1];
  const stmtBody = m[2].trim();
  if (!/^add\s+column\b/i.test(stmtBody)) continue;
  const target = tableMap.get(name);
  if (!target) continue;

  for (const clause of splitTopLevel(stmtBody)) {
    const cleaned = clause.replace(/^add\s+column\s+(?:if\s+not\s+exists\s+)?/i, '').trim();
    const parsed = parseColumnDef(cleaned);
    if (!parsed) continue;
    parsed.addedByAlter = true;
    const existingIdx = target.columns.findIndex((c) => c.col === parsed.col);
    if (existingIdx >= 0) {
      target.columns[existingIdx] = parsed;
    } else {
      target.columns.push(parsed);
    }
  }
}

// ---- emissione ----------------------------------------------------------------------------------
const q = (c) => (/^[a-z_]\w*$/i.test(c) ? c : `'${c}'`);
let out = `/* eslint-disable */
/**
 * FILE GENERATO – NON MODIFICARE A MANO.
 * Sorgenti:
 *   - supabase/migrations/01_init_schema.sql
 *   - supabase/da-applicare/10_contabilita_schema_modello_obiettivo.sql
 * Rigenera con: npm run gen:types
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ============================== Interfacce di riga (Row) ==============================
`;
for (const t of tables) {
  out += `export interface ${t.iface} {\n`;
  for (const c of t.columns) {
    out += `  ${q(c.col)}${c.addedByAlter ? '?' : ''}: ${c.ts}${c.nullable ? ' | null' : ''};\n`;
  }
  out += `}\n\n`;
}

out += `// ============================== Database (formato supabase-js) ==============================
/** Converte un'interfaccia in type-alias (richiesto da supabase-js: niente index-signature mancante). */
type Plain<T> = { [K in keyof T]: T[K] };

export interface Database {
  public: {
    Tables: {
`;
for (const t of tables) {
  const opt = t.columns.filter((c) => c.nullable || c.hasDefault || c.addedByAlter).map((c) => `'${c.col}'`);
  out += `      ${t.name}: {
        Row: Plain<${t.iface}>;
        Insert: Plain<Omit<${t.iface}, ${opt.length ? opt.join(' | ') : 'never'}>${opt.length ? ` & Partial<Pick<${t.iface}, ${opt.join(' | ')}>>` : ''}>;
        Update: Plain<Partial<${t.iface}>>;
        Relationships: [];
      };
`;
}
out += `    };
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
      has_readonly_audit_access: { Args: { p_cond: string }; Returns: boolean };
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

/**
 * Ruoli dell'app. \`RuoloCodice\` specchia \`ruoli_piattaforma\` (CHECK a 3 codici); gli altri due
 * non sono righe di quella tabella: SUPER_ADMIN = flag \`utenti.is_superadmin\`,
 * FORNITORE = accesso via \`fornitori_tokens\` (magic link) / tabella \`fornitori\`.
 */
export type RuoloApp = RuoloCodice | 'SUPER_ADMIN' | 'FORNITORE';

export const RUOLI_APP: readonly RuoloApp[] = ['SUPER_ADMIN', 'ADMIN', 'CONDOMINO', 'PORTIERE', 'FORNITORE'];

// ============================== Navigazione per ruolo ==============================
/** Voce di navigazione (sidebar su desktop, barra in basso su smartphone). \`icon\` = nome icona Lucide. */
export interface INavVoce {
  id: string;
  label: string;
  icon: string;
  /** Percorso expo-router (es. '/assemblee'). */
  route: string;
}

export type NavigazioneRuolo = Record<RuoloApp, readonly INavVoce[]>;

/** Voci della sidebar minima del Super Admin. */
export type SuperAdminNavId = 'amministratori' | 'piani-abbonamenti' | 'fatture' | 'impostazioni';
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out, 'utf8');
console.log(`Generate ${tables.length} interfacce -> ${outPath}`);
