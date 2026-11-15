/**
 * Logica pura per la Dashboard Telemetria & Prestazioni Super Admin.
 * Nessuna dipendenza da Supabase o React: testabile con `node --test`.
 */

export type IntervalloTelemetria = '24h' | '7g' | '30g';

export type CategoriaNotifica = 'Comunicazioni' | 'Assemblee' | 'Bollettini' | 'Altro';

export type LivelloCapacita = 'ok' | 'attenzione' | 'critico';

export interface PuntoSerieOraria {
  oraBucket: string;
  utentiAttivi: number;
  getCount: number;
  insertCount: number;
  putPatchCount: number;
  deleteCount: number;
  edgeFnCount: number;
  erroriCount: number;
  totaleOperazioni: number;
}

export interface RiepilogoNotificheCategoria {
  comunicazioni: number;
  assemblee: number;
  bollettini: number;
  altro: number;
  totale: number;
}

export interface RiepilogoCodaEmailTelemetria {
  disponibile: boolean;
  perCategoria: {
    comunicazioni: number;
    assemblee: number;
    bollettini: number;
  };
  perStato: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
  totale: number;
}

export interface ConteggioTabella {
  tabella: string;
  righe: number;
}

export interface MetricheDatabase {
  dbSizeBytes: number;
  dbSizeMb: number;
  mau30g: number;
  utentiTotali: number;
  condominiAttivi: number;
  condominiSospesi: number;
  righeTabelle: ConteggioTabella[];
}

export interface DashboardTelemetriaData {
  generatoAt: string;
  oreRichieste: number;
  serieOraria: PuntoSerieOraria[];
  notifichePeriodo: RiepilogoNotificheCategoria;
  notificheStorico: RiepilogoNotificheCategoria;
  codaEmail: RiepilogoCodaEmailTelemetria;
  database: MetricheDatabase;
}

export interface KpiTelemetria {
  piccoOrarioUtenti: number;
  oraPiccoUtenti: string | null;
  totaleGet: number;
  totaleInsert: number;
  totalePutPatch: number;
  totaleDelete: number;
  totaleEdgeFn: number;
  totaleErrori: number;
  totaleOperazioni: number;
  totaleScritture: number;
  rapportoLettureScritture: string;
  piccoScrittureOra: number;
}

export interface StatoCapacitaRisorsa {
  id: 'db_size' | 'mau' | 'scritture_ora';
  titolo: string;
  livello: LivelloCapacita;
  etichettaStato: string;
  percentuale: number;
  valoreFormattato: string;
  sogliaFormattata: string;
  descrizione: string;
}

export interface ValutazioneCapacitaPiattaforma {
  livelloGenerale: LivelloCapacita;
  risorse: StatoCapacitaRisorsa[];
  consiglioSupabase: string;
}

export const LIMITE_FREE_DB_MB = 500;
export const LIMITE_FREE_MAU = 50_000;
export const RIFERIMENTO_SCRITTURE_ORA = 1_000;

export function orePerIntervallo(intervallo: IntervalloTelemetria): number {
  if (intervallo === '7g') return 168;
  if (intervallo === '30g') return 720;
  return 24;
}

export function classificaCategoriaNotifica(
  tipo: string | null | undefined,
  riferimentoTabella?: string | null,
): CategoriaNotifica {
  const t = (tipo ?? '').toUpperCase();
  const ref = (riferimentoTabella ?? '').toLowerCase();

  if (t.includes('COMUNICAZ') || ref === 'bacheca_post') {
    return 'Comunicazioni';
  }
  if (t.includes('ASSEMBLE') || ref === 'assemblee' || ref === 'assemblee_odg') {
    return 'Assemblee';
  }
  if (
    t.includes('BOLLETTIN') ||
    t.includes('RATA') ||
    t.includes('PAGAMENT') ||
    ref === 'bollettini' ||
    ref === 'rate' ||
    ref === 'pagamenti'
  ) {
    return 'Bollettini';
  }
  return 'Altro';
}

export function aggregaNotifichePerCategoria(
  righe: ReadonlyArray<{ tipo?: string | null; riferimento_tabella?: string | null }>,
): RiepilogoNotificheCategoria {
  let comunicazioni = 0;
  let assemblee = 0;
  let bollettini = 0;
  let altro = 0;

  for (const r of righe) {
    const cat = classificaCategoriaNotifica(r.tipo, r.riferimento_tabella);
    if (cat === 'Comunicazioni') comunicazioni += 1;
    else if (cat === 'Assemblee') assemblee += 1;
    else if (cat === 'Bollettini') bollettini += 1;
    else altro += 1;
  }

  return {
    comunicazioni,
    assemblee,
    bollettini,
    altro,
    totale: righe.length,
  };
}

export function calcolaPercentualeCategoria(valore: number, totale: number): number {
  if (totale <= 0 || valore <= 0) return 0;
  return Math.round((valore / totale) * 100);
}

export function calcolaKpiTelemetria(data: DashboardTelemetriaData): KpiTelemetria {
  let piccoOrarioUtenti = 0;
  let oraPiccoUtenti: string | null = null;
  let totaleGet = 0;
  let totaleInsert = 0;
  let totalePutPatch = 0;
  let totaleDelete = 0;
  let totaleEdgeFn = 0;
  let totaleErrori = 0;
  let piccoScrittureOra = 0;

  for (const punto of data.serieOraria) {
    if (punto.utentiAttivi > piccoOrarioUtenti) {
      piccoOrarioUtenti = punto.utentiAttivi;
      oraPiccoUtenti = punto.oraBucket;
    }
    totaleGet += punto.getCount;
    totaleInsert += punto.insertCount;
    totalePutPatch += punto.putPatchCount;
    totaleDelete += punto.deleteCount;
    totaleEdgeFn += punto.edgeFnCount;
    totaleErrori += punto.erroriCount;

    const scrittureOra = punto.insertCount + punto.putPatchCount + punto.deleteCount;
    if (scrittureOra > piccoScrittureOra) {
      piccoScrittureOra = scrittureOra;
    }
  }

  const totaleScritture = totaleInsert + totalePutPatch + totaleDelete;
  const totaleOperazioni = totaleGet + totaleScritture + totaleEdgeFn;

  let rapportoLettureScritture = '0 : 0';
  if (totaleGet === 0 && totaleScritture === 0) {
    rapportoLettureScritture = 'N/D';
  } else if (totaleScritture === 0) {
    rapportoLettureScritture = `${totaleGet} : 0 (solo letture)`;
  } else {
    const ratio = (totaleGet / totaleScritture).toFixed(1).replace('.', ',');
    rapportoLettureScritture = `${ratio} : 1`;
  }

  return {
    piccoOrarioUtenti,
    oraPiccoUtenti,
    totaleGet,
    totaleInsert,
    totalePutPatch,
    totaleDelete,
    totaleEdgeFn,
    totaleErrori,
    totaleOperazioni,
    totaleScritture,
    rapportoLettureScritture,
    piccoScrittureOra,
  };
}

function livelloDaPercentuale(percentuale: number): { livello: LivelloCapacita; etichetta: string } {
  if (percentuale >= 85) return { livello: 'critico', etichetta: 'Soglia critica' };
  if (percentuale >= 65) return { livello: 'attenzione', etichetta: 'In avvicinamento' };
  return { livello: 'ok', etichetta: 'Nella norma' };
}

export function calcolaSoglieCapacita(params: {
  dbSizeMb: number;
  mau30g: number;
  piccoScrittureOra: number;
}): ValutazioneCapacitaPiattaforma {
  const dbPerc = Math.min(100, Math.round((Math.max(0, params.dbSizeMb) / LIMITE_FREE_DB_MB) * 100));
  const dbStato = livelloDaPercentuale(dbPerc);

  const mauPerc = Math.min(100, Math.round((Math.max(0, params.mau30g) / LIMITE_FREE_MAU) * 100));
  const mauStato = livelloDaPercentuale(mauPerc);

  const scritturePerc = Math.min(
    100,
    Math.round((Math.max(0, params.piccoScrittureOra) / RIFERIMENTO_SCRITTURE_ORA) * 100),
  );
  const scrittureStato = livelloDaPercentuale(scritturePerc);

  const risorse: StatoCapacitaRisorsa[] = [
    {
      id: 'db_size',
      titolo: 'Spazio Database Postgres',
      livello: dbStato.livello,
      etichettaStato: dbStato.etichetta,
      percentuale: dbPerc,
      valoreFormattato: `${params.dbSizeMb.toFixed(1).replace('.', ',')} MB`,
      sogliaFormattata: `${LIMITE_FREE_DB_MB} MB (Piano Free)`,
      descrizione:
        dbStato.livello === 'ok'
          ? 'Spazio ampiamente entro il limite del piano Free.'
          : 'Spazio in crescita: valuta il passaggio a Supabase Pro (8 GB inclusi).',
    },
    {
      id: 'mau',
      titolo: 'Utenti Attivi Mensili (MAU 30g)',
      livello: mauStato.livello,
      etichettaStato: mauStato.etichetta,
      percentuale: mauPerc,
      valoreFormattato: params.mau30g.toLocaleString('it-IT'),
      sogliaFormattata: `${LIMITE_FREE_MAU.toLocaleString('it-IT')} MAU (Piano Free)`,
      descrizione:
        mauStato.livello === 'ok'
          ? 'Utenti attivi mensili ben al di sotto del limite Free.'
          : 'Traffico utenti elevato: pianifica upgrade a Supabase Pro (100.000 MAU).',
    },
    {
      id: 'scritture_ora',
      titolo: 'Picco Scritture / Ora',
      livello: scrittureStato.livello,
      etichettaStato: scrittureStato.etichetta,
      percentuale: scritturePerc,
      valoreFormattato: `${params.piccoScrittureOra.toLocaleString('it-IT')} op/ora`,
      sogliaFormattata: `${RIFERIMENTO_SCRITTURE_ORA.toLocaleString('it-IT')} op/ora (soglia di attenzione)`,
      descrizione:
        scrittureStato.livello === 'ok'
          ? 'Carico di scrittura sostenibile senza colli di bottiglia.'
          : 'Picchi di scrittura sostenuti: monitora connessioni e IOPS su Supabase.',
    },
  ];

  const haCritico = risorse.some((r) => r.livello === 'critico');
  const haAttenzione = risorse.some((r) => r.livello === 'attenzione');
  const livelloGenerale: LivelloCapacita = haCritico ? 'critico' : haAttenzione ? 'attenzione' : 'ok';

  const consiglioSupabase =
    livelloGenerale === 'critico'
      ? 'Consigliato upgrade immediato a Supabase Pro: una o più risorse sono vicine o oltre il limite del piano Free.'
      : livelloGenerale === 'attenzione'
        ? 'Monitoraggio consigliato: almeno una metrica supera il 65% della soglia di riferimento Free. Valuta Supabase Pro se la crescita continua.'
        : 'Capacità attuale adeguata al piano Supabase Free. Nessun upgrade urgente necessario.';

  return {
    livelloGenerale,
    risorse,
    consiglioSupabase,
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseNotificheCat(raw: unknown): RiepilogoNotificheCategoria {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    comunicazioni: num(obj.comunicazioni),
    assemblee: num(obj.assemblee),
    bollettini: num(obj.bollettini),
    altro: num(obj.altro),
    totale: num(obj.totale),
  };
}

export function normalizzaRispostaTelemetria(raw: unknown): DashboardTelemetriaData {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const serieRaw = Array.isArray(obj.serie_oraria) ? obj.serie_oraria : [];
  const serieOraria: PuntoSerieOraria[] = serieRaw.map((item) => {
    const r = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const getCount = num(r.get_count);
    const insertCount = num(r.insert_count);
    const putPatchCount = num(r.put_patch_count);
    const deleteCount = num(r.delete_count);
    const edgeFnCount = num(r.edge_fn_count);
    return {
      oraBucket: typeof r.ora_bucket === 'string' ? r.ora_bucket : new Date().toISOString(),
      utentiAttivi: num(r.utenti_attivi),
      getCount,
      insertCount,
      putPatchCount,
      deleteCount,
      edgeFnCount,
      erroriCount: num(r.errori_count),
      totaleOperazioni: getCount + insertCount + putPatchCount + deleteCount + edgeFnCount,
    };
  });

  const notificheObj =
    obj.notifiche && typeof obj.notifiche === 'object' ? (obj.notifiche as Record<string, unknown>) : {};

  const codaRaw =
    obj.coda_email && typeof obj.coda_email === 'object' ? (obj.coda_email as Record<string, unknown>) : {};
  const codaCat =
    codaRaw.per_categoria && typeof codaRaw.per_categoria === 'object'
      ? (codaRaw.per_categoria as Record<string, unknown>)
      : {};
  const codaStato =
    codaRaw.per_stato && typeof codaRaw.per_stato === 'object'
      ? (codaRaw.per_stato as Record<string, unknown>)
      : {};

  const dbRaw =
    obj.database && typeof obj.database === 'object' ? (obj.database as Record<string, unknown>) : {};
  const dbSizeBytes = num(dbRaw.db_size_bytes);
  const righeRaw = Array.isArray(dbRaw.righe_tabelle) ? dbRaw.righe_tabelle : [];

  return {
    generatoAt: typeof obj.generato_at === 'string' ? obj.generato_at : new Date().toISOString(),
    oreRichieste: num(obj.ore_richieste) || 24,
    serieOraria,
    notifichePeriodo: parseNotificheCat(notificheObj.periodo),
    notificheStorico: parseNotificheCat(notificheObj.storico),
    codaEmail: {
      disponibile: codaRaw.disponibile === true,
      perCategoria: {
        comunicazioni: num(codaCat.comunicazioni),
        assemblee: num(codaCat.assemblee),
        bollettini: num(codaCat.bollettini),
      },
      perStato: {
        pending: num(codaStato.pending),
        processing: num(codaStato.processing),
        sent: num(codaStato.sent),
        failed: num(codaStato.failed),
        cancelled: num(codaStato.cancelled),
      },
      totale: num(codaRaw.totale),
    },
    database: {
      dbSizeBytes,
      dbSizeMb: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
      mau30g: num(dbRaw.mau_30g),
      utentiTotali: num(dbRaw.utenti_totali),
      condominiAttivi: num(dbRaw.condomini_attivi),
      condominiSospesi: num(dbRaw.condomini_sospesi),
      righeTabelle: righeRaw.map((t) => {
        const row = t && typeof t === 'object' ? (t as Record<string, unknown>) : {};
        return {
          tabella: typeof row.tabella === 'string' ? row.tabella : '',
          righe: num(row.righe),
        };
      }),
    },
  };
}
