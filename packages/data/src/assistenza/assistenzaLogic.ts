/**
 * Logica pura per la schermata di Assistenza e Numeri Utili del condominio.
 * File puro (nessuna dipendenza da Expo, React o Supabase), testato con `node --test`.
 */

export interface ContattiAmministrazione {
  nomeStudio: string;
  amministratore: string;
  email: string | null;
  telefono: string | null;
  orariReperibilita: string;
  indirizzoStudio: string | null;
}

export interface NumeroEmergenza {
  id: string;
  titolo: string;
  categoria: 'ascensore' | 'guasti' | 'emergenza' | 'assicurazione' | 'amministrazione';
  numero: string;
  disponibilita: string;
  descrizione: string;
  icona: 'wrench' | 'phone' | 'shield' | 'shield-alert';
  visibile: boolean;
}

export interface NumeroAssistenzaOverride {
  id: string;
  titolo: string;
  numero: string;
  visibile?: boolean;
}

export interface PolizzaFabbricato {
  id: string;
  compagnia: string;
  numeroPolizza: string | null;
  premioAnnuo: number | null;
  dataScadenza: string;
  docId: string | null;
}

export interface DatiAssistenza {
  condominioId: string;
  condominioNome: string;
  condominioIndirizzo: string | null;
  amministrazione: ContattiAmministrazione;
  numeriEmergenza: NumeroEmergenza[];
  polizza: PolizzaFabbricato | null;
}

export interface FornitoreEmergenzaRaw {
  id: string;
  ragione_sociale: string;
  telefono: string | null;
  categoria: string | null;
}

export const NUMERI_NAZIONALI_EMERGENZA: readonly NumeroEmergenza[] = [
  {
    id: 'num-emergenza-112',
    titolo: 'Numero Unico Europeo Emergenze',
    categoria: 'emergenza',
    numero: '112',
    disponibilita: '24 ore su 24, 7 giorni su 7',
    descrizione: 'Per emergenze sanitarie, carabinieri, polizia di stato e soccorso pubblico immediato.',
    icona: 'shield-alert',
    visibile: true,
  },
  {
    id: 'num-emergenza-115',
    titolo: 'Vigili del Fuoco',
    categoria: 'emergenza',
    numero: '115',
    disponibilita: '24 ore su 24, 7 giorni su 7',
    descrizione: 'Soccorso tecnico urgente, incendi, allagamenti gravi e fughe di gas.',
    icona: 'shield-alert',
    visibile: true,
  },
];

/**
 * Compone la lista dei numeri utili combinando eventuali fornitori contrattualizzati
 * (ascensore, reperibilità tecnica), assistenza della polizza e numeri di emergenza nazionali.
 */
export function componiNumeriEmergenza(
  fornitori: readonly FornitoreEmergenzaRaw[],
  polizza: PolizzaFabbricato | null,
): NumeroEmergenza[] {
  const lista: NumeroEmergenza[] = [];

  // 1. Ascensore: verifica se presente un fornitore di categoria Ascensore
  const fornitoreAscensore = fornitori.find((f) => /ascensor/i.test(f.categoria ?? '') || /ascensor/i.test(f.ragione_sociale));
  if (fornitoreAscensore && fornitoreAscensore.telefono) {
    lista.push({
      id: `forn-${fornitoreAscensore.id}`,
      titolo: `Pronto Intervento Ascensore (${fornitoreAscensore.ragione_sociale})`,
      categoria: 'ascensore',
      numero: fornitoreAscensore.telefono,
      disponibilita: 'H24 per persone bloccate in cabina',
      descrizione: 'In caso di blocco impianto, fermata fuori piano o emergenza persone in cabina.',
      icona: 'wrench',
      visibile: true,
    });
  } else {
    lista.push({
      id: 'default-ascensore',
      titolo: 'Pronto Intervento Ascensore',
      categoria: 'ascensore',
      numero: '800 123 456',
      disponibilita: 'Reperibilità H24 urgenze',
      descrizione: 'Numero verde assistenza tecnica per sblocco cabina e guasti all’impianto ascensore.',
      icona: 'wrench',
      visibile: true,
    });
  }

  // 2. Guasti idraulici / elettrici urgenti
  const fornitoreGuasti = fornitori.find((f) =>
    /idraulic|elettric|pronto intervento|manutenzion/i.test(f.categoria ?? '')
  );
  if (fornitoreGuasti && fornitoreGuasti.telefono) {
    lista.push({
      id: `forn-${fornitoreGuasti.id}`,
      titolo: `Pronto Intervento Tecnico (${fornitoreGuasti.ragione_sociale})`,
      categoria: 'guasti',
      numero: fornitoreGuasti.telefono,
      disponibilita: 'Reperibilità guasti urgenti parti comuni',
      descrizione: `Assistenza manutentiva specializzata (${fornitoreGuasti.categoria ?? 'Tecnico convenzionato'}).`,
      icona: 'wrench',
      visibile: true,
    });
  } else {
    lista.push({
      id: 'default-guasti',
      titolo: 'Pronto Intervento Fabbro e Idraulico',
      categoria: 'guasti',
      numero: '+39 06 998877',
      disponibilita: 'Reperibilità festivi e notturni',
      descrizione: 'Allagamenti colonne di scarico, rottura tubazioni e cancelli carrabili bloccati.',
      icona: 'wrench',
      visibile: true,
    });
  }

  // 3. Assistenza Polizza Globale Fabbricati (se presente polizza)
  if (polizza) {
    lista.push({
      id: `polizza-${polizza.id}`,
      titolo: `Centrale Sinistri ${polizza.compagnia}`,
      categoria: 'assicurazione',
      numero: '800 889 900',
      disponibilita: 'Lun - Ven: 08:30 - 18:30',
      descrizione: `Denuncia sinistri polizza n. ${polizza.numeroPolizza ?? 'in vigore'}. Riferire gli estremi del fabbricato.`,
      icona: 'shield',
      visibile: true,
    });
  }

  // 4. Numeri nazionali
  lista.push(...NUMERI_NAZIONALI_EMERGENZA);

  return lista;
}

/**
 * Costruisce i contatti di recapito dell'amministratore con fallback coerenti
 * se alcuni campi risultano non popolati nel DB.
 */
export function costruisciContattiAmministrazione(input: {
  condominioNome: string;
  indirizzoCondominio?: string | null;
  cittaCondominio?: string | null;
  adminNome?: string | null;
  adminEmail?: string | null;
  adminTelefono?: string | null;
}): ContattiAmministrazione {
  const nomeAdmin = input.adminNome?.trim() || 'Amministratore di Condominio';
  const nomeStudio = nomeAdmin.startsWith('Studio') ? nomeAdmin : `Studio ${nomeAdmin}`;
  const indirizzoStudio = input.indirizzoCondominio
    ? `${input.indirizzoCondominio}${input.cittaCondominio ? `, ${input.cittaCondominio}` : ''}`
    : 'Presso la sede del Condominio';

  return {
    nomeStudio,
    amministratore: nomeAdmin,
    email: input.adminEmail?.trim() || 'amministrazione@iocondo.it',
    telefono: input.adminTelefono?.trim() || '+39 06 5550202',
    orariReperibilita: 'Lunedì – Venerdì: 09:00 – 13:00 e 15:00 – 18:30',
    indirizzoStudio,
  };
}

/**
 * Estrae in sicurezza la lista degli override salvati nel campo JSONB `numeri_assistenza`.
 */
export function parseNumeriAssistenzaOverrides(raw: unknown): NumeroAssistenzaOverride[] {
  if (!Array.isArray(raw)) return [];
  const risultato: NumeroAssistenzaOverride[] = [];
  for (const voce of raw) {
    if (!voce || typeof voce !== 'object') continue;
    const rec = voce as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id.trim() : '';
    const titolo = typeof rec.titolo === 'string' ? rec.titolo.trim() : '';
    const numero = typeof rec.numero === 'string' ? rec.numero.trim() : '';
    const visibile = typeof rec.visibile === 'boolean' ? rec.visibile : undefined;
    if (!id) continue;
    if (!titolo && !numero && visibile === undefined) continue;
    risultato.push({ id, titolo, numero, ...(visibile !== undefined ? { visibile } : {}) });
  }
  return risultato;
}

/**
 * Applica gli override personalizzati dall'amministratore ai numeri di emergenza base.
 */
export function applicaOverrideNumeriEmergenza(
  base: readonly NumeroEmergenza[],
  overrides: readonly NumeroAssistenzaOverride[],
): NumeroEmergenza[] {
  if (overrides.length === 0) return [...base];
  const mappa = new Map(overrides.map((o) => [o.id, o]));
  return base.map((item) => {
    const ov = mappa.get(item.id);
    if (!ov) return item;
    return {
      ...item,
      titolo: ov.titolo || item.titolo,
      numero: ov.numero || item.numero,
      visibile: typeof ov.visibile === 'boolean' ? ov.visibile : item.visibile,
    };
  });
}

/**
 * Valida titolo e numero inseriti dall'amministratore prima del salvataggio.
 */
export function validaModificaNumeroEmergenza(input: {
  titolo: string;
  numero: string;
}): { valido: boolean; erroreTitolo?: string; erroreNumero?: string } {
  const titolo = input.titolo.trim();
  const numero = input.numero.trim();
  let erroreTitolo: string | undefined;
  let erroreNumero: string | undefined;

  if (titolo.length < 2) {
    erroreTitolo = 'Inserisci un titolo di almeno 2 caratteri.';
  } else if (titolo.length > 120) {
    erroreTitolo = 'Il titolo non può superare 120 caratteri.';
  }

  if (numero.length < 2) {
    erroreNumero = 'Inserisci un numero valido.';
  } else if (numero.length > 40) {
    erroreNumero = 'Il numero non può superare 40 caratteri.';
  }

  return {
    valido: !erroreTitolo && !erroreNumero,
    erroreTitolo,
    erroreNumero,
  };
}

/**
 * Aggiorna o inserisce un override nella lista esistente in modo immutabile.
 */
export function aggiornaListaOverrides(
  esistenti: readonly NumeroAssistenzaOverride[],
  cardId: string,
  titolo: string,
  numero: string,
  visibile = true,
): NumeroAssistenzaOverride[] {
  const nuovo: NumeroAssistenzaOverride = {
    id: cardId,
    titolo: titolo.trim(),
    numero: numero.trim(),
    visibile,
  };
  const indice = esistenti.findIndex((o) => o.id === cardId);
  if (indice === -1) {
    return [...esistenti, nuovo];
  }
  return esistenti.map((o, idx) => (idx === indice ? nuovo : o));
}

