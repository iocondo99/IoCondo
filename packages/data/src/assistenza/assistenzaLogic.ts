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
  },
  {
    id: 'num-emergenza-115',
    titolo: 'Vigili del Fuoco',
    categoria: 'emergenza',
    numero: '115',
    disponibilita: '24 ore su 24, 7 giorni su 7',
    descrizione: 'Soccorso tecnico urgente, incendi, allagamenti gravi e fughe di gas.',
    icona: 'shield-alert',
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

