import type { ICodaEmail } from '@iocondo/shared-types';

export type TipoEventoEmail = ICodaEmail['tipo_evento'];
export type StatoCodaEmail = ICodaEmail['stato'];

export interface MittenteAmministratoreInput {
  nomeCognome?: string | null;
  email?: string | null;
}

export interface MittenteAmministratore {
  /** Nome mostrato come mittente (es. "Mario Rossi (IoCondo)"). */
  nomeVisualizzato: string;
  /** Valore mostrato come `From` (display name; la casella reale è quella Gmail dell'app). */
  fromEmail: string;
  /** Email reale dell'amministratore, usata come Reply-To. */
  replyToEmail: string | null;
}

export interface DatiTemplateBollettino {
  condominioNome: string;
  destinatarioNome?: string | null;
  numeroProgressivo: number;
  anno: number;
  totaleCentesimi: number;
  dataScadenza: string;
  causale?: string | null;
  ibanAccredito?: string | null;
  unitaLabel?: string | null;
  righeDescrizione?: string[];
}

export interface DatiTemplateAssemblea {
  condominioNome: string;
  destinatarioNome?: string | null;
  tipo: 'ORDINARIA' | 'STRAORDINARIA' | string;
  dataPrimaConvocazione?: string | null;
  dataSecondaConvocazione?: string | null;
  dataPrincipale: string;
  luogo?: string | null;
  linkMeet?: string | null;
  puntiOdg: Array<{ ordine: number; titolo: string; descrizione?: string | null }>;
}

export interface DatiTemplateComunicazione {
  condominioNome: string;
  destinatarioNome?: string | null;
  titolo: string;
  corpo?: string | null;
  ambitoLabel: string;
}

export interface EmailRenderizzata {
  oggetto: string;
  htmlBody: string;
  textBody: string;
}

export interface RiepilogoCodaEmail {
  totali: number;
  inAttesa: number;
  inviate: number;
  fallite: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Verifica formale di un indirizzo email. */
export function isEmailValida(email: string | null | undefined): email is string {
  if (typeof email !== 'string') return false;
  if (/[\r\n\0]/.test(email)) return false;
  const trimmed = email.trim();
  return trimmed.length <= 320 && EMAIL_REGEX.test(trimmed);
}

function pulisciOggettoEmail(testo: string): string {
  return testo.replace(/[\r\n\0]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pulisciNomeHeader(nomeCognome?: string | null): string {
  if (typeof nomeCognome !== 'string') return 'Amministratore Condominio';
  const pulito = nomeCognome
    .replace(/[\r\n\0<>"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return pulito || 'Amministratore Condominio';
}

/**
 * Anteprima del mittente mostrato all'amministratore: nome visualizzato e Reply-To.
 * La casella reale di invio è sempre quella Gmail dell'app (configurata lato server).
 * Esempio: nome "Mario Rossi (IoCondo)", Reply-To `mario.rossi@studio.it`.
 */
export function costruisciMittenteAmministratore(
  input: MittenteAmministratoreInput,
): MittenteAmministratore {
  // Il mittente reale è sempre la casella Gmail dell'app (lato server): qui serve
  // solo l'anteprima del nome mostrato e il Reply-To all'email dell'amministratore.
  const nome = pulisciNomeHeader(input.nomeCognome);
  const nomeVisualizzato = nome === 'Amministratore Condominio' ? nome : `${nome} (IoCondo)`;
  const replyToEmail = isEmailValida(input.email) ? input.email.trim().toLowerCase() : null;

  return {
    nomeVisualizzato,
    fromEmail: nomeVisualizzato,
    replyToEmail,
  };
}

/**
 * Chiave deterministica di idempotenza per evitare duplicati in `coda_email` e invii ripetuti.
 */
export function costruisciIdempotencyKey(
  tipoEvento: TipoEventoEmail,
  riferimentoId: string,
  destinatarioEmail: string,
): string {
  const emailNorm = destinatarioEmail.trim().toLowerCase();
  return `${tipoEvento}:${riferimentoId}:${emailNorm}`;
}

/**
 * Calcola il timestamp ISO del prossimo tentativo con backoff esponenziale (in minuti):
 * tentativo 1 -> +2 min, 2 -> +6 min, 3 -> +18 min, 4 -> +54 min, 5+ -> +120 min.
 */
export function calcolaProssimoTentativoIso(
  tentativiFalliti: number,
  adesso: Date = new Date(),
): string {
  const n = Math.max(1, Math.floor(tentativiFalliti));
  const minuti = Math.min(2 * Math.pow(3, n - 1), 120);
  return new Date(adesso.getTime() + minuti * 60_000).toISOString();
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formattaEuroDaCentesimi(centesimi: number): string {
  const euro = (centesimi / 100).toFixed(2).replace('.', ',');
  return `€ ${euro}`;
}

function formattaDataBreveIt(isoDate: string | null | undefined): string {
  if (!isoDate) return 'Da definire';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formattaDataOraIt(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return 'Da definire';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${gg}/${mm}/${yyyy} alle ${hh}:${min}`;
}

function costruisciNotaFooter(mittente: MittenteAmministratore): { html: string; text: string } {
  const nome = mittente.nomeVisualizzato;
  if (mittente.replyToEmail) {
    const testo = `Inviato per conto di ${nome}. Per rispondere utilizza il tasto Rispondi (destinatario: ${mittente.replyToEmail}).`;
    return {
      html: `<p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">${escapeHtml(testo)}</p>`,
      text: testo,
    };
  }
  const testo = `Inviato per conto di ${nome} tramite IoCondo.`;
  return {
    html: `<p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">${escapeHtml(testo)}</p>`,
    text: testo,
  };
}

function avvolgiLayoutHtml(params: {
  condominioNome: string;
  titoloBanner: string;
  contenutoHtml: string;
  mittente: MittenteAmministratore;
}): string {
  const footer = costruisciNotaFooter(params.mittente);
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#0D3B66;padding:20px 24px;">
              <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;color:#CCFBF1;font-weight:600;">${escapeHtml(params.condominioNome)}</p>
              <h1 style="margin:0;font-size:20px;line-height:1.3;color:#FFFFFF;font-weight:600;">${escapeHtml(params.titoloBanner)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.6;color:#0F172A;">
              ${params.contenutoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background-color:#F8FAFC;border-top:1px solid #E5E7EB;">
              ${footer.html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Genera oggetto, HTML e testo per `BOLLETTINO_EMESSO`. */
export function generaTemplateBollettinoEmesso(
  dati: DatiTemplateBollettino,
  mittente: MittenteAmministratore,
): EmailRenderizzata {
  const num = `n. ${dati.numeroProgressivo}/${dati.anno}`;
  const importo = formattaEuroDaCentesimi(dati.totaleCentesimi);
  const scadenza = formattaDataBreveIt(dati.dataScadenza);
  const saluto = dati.destinatarioNome?.trim()
    ? `Gentile ${dati.destinatarioNome.trim()},`
    : 'Gentile Condòmino,';
  const oggetto = pulisciOggettoEmail(`Bollettino ${num} emesso (${importo}) - ${dati.condominioNome}`);

  const righeHtml = (dati.righeDescrizione ?? []).length
    ? `<ul style="margin:8px 0 16px 20px;padding:0;color:#475569;">${dati.righeDescrizione!
        .map((r) => `<li style="margin-bottom:4px;">${escapeHtml(r)}</li>`)
        .join('')}</ul>`
    : '';

  const contenutoHtml = `
    <p style="margin:0 0 12px 0;">${escapeHtml(saluto)}</p>
    <p style="margin:0 0 16px 0;">è stato emesso un nuovo bollettino condominiale per <strong>${escapeHtml(dati.condominioNome)}</strong>.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background-color:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:16px;">
      <tr><td style="color:#475569;width:42%;">Bollettino</td><td style="font-weight:600;">${escapeHtml(num)}</td></tr>
      <tr><td style="color:#475569;">Importo totale</td><td style="font-weight:700;color:#0D3B66;">${escapeHtml(importo)}</td></tr>
      <tr><td style="color:#475569;">Scadenza</td><td style="font-weight:600;">${escapeHtml(scadenza)}</td></tr>
      ${dati.unitaLabel ? `<tr><td style="color:#475569;">Unità immobiliare</td><td>${escapeHtml(dati.unitaLabel)}</td></tr>` : ''}
      ${dati.causale ? `<tr><td style="color:#475569;">Causale</td><td>${escapeHtml(dati.causale)}</td></tr>` : ''}
      ${dati.ibanAccredito ? `<tr><td style="color:#475569;">IBAN accredito</td><td style="font-family:monospace;">${escapeHtml(dati.ibanAccredito)}</td></tr>` : ''}
    </table>
    ${righeHtml}
    <p style="margin:0;color:#475569;font-size:14px;">Puoi consultare il dettaglio completo nella sezione Pagamenti dell'app IoCondo.</p>
  `;

  const footer = costruisciNotaFooter(mittente);
  const textLines = [
    saluto,
    '',
    `È stato emesso il bollettino ${num} per ${dati.condominioNome}.`,
    `- Importo: ${importo}`,
    `- Scadenza: ${scadenza}`,
    dati.unitaLabel ? `- Unità immobiliare: ${dati.unitaLabel}` : null,
    dati.causale ? `- Causale: ${dati.causale}` : null,
    dati.ibanAccredito ? `- IBAN accredito: ${dati.ibanAccredito}` : null,
    ...(dati.righeDescrizione ?? []).map((r) => `  * ${r}`),
    '',
    footer.text,
  ].filter((l): l is string => l !== null);

  return {
    oggetto,
    htmlBody: avvolgiLayoutHtml({
      condominioNome: dati.condominioNome,
      titoloBanner: `Bollettino ${num} emesso`,
      contenutoHtml,
      mittente,
    }),
    textBody: textLines.join('\n'),
  };
}

/** Genera oggetto, HTML e testo per `CONVOCAZIONE_ASSEMBLEA`. */
export function generaTemplateConvocazioneAssemblea(
  dati: DatiTemplateAssemblea,
  mittente: MittenteAmministratore,
): EmailRenderizzata {
  const tipoLabel = dati.tipo === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria';
  const saluto = dati.destinatarioNome?.trim()
    ? `Gentile ${dati.destinatarioNome.trim()},`
    : 'Gentile Condòmino,';
  const oggetto = pulisciOggettoEmail(`Convocazione Assemblea ${tipoLabel} - ${dati.condominioNome}`);

  const prima = dati.dataPrimaConvocazione
    ? formattaDataOraIt(dati.dataPrimaConvocazione)
    : formattaDataOraIt(dati.dataPrincipale);
  const seconda = dati.dataSecondaConvocazione
    ? formattaDataOraIt(dati.dataSecondaConvocazione)
    : null;

  const odgHtml = dati.puntiOdg.length
    ? `<ol style="margin:8px 0 16px 20px;padding:0;">${dati.puntiOdg
        .map(
          (p) =>
            `<li style="margin-bottom:6px;"><strong>${escapeHtml(p.titolo)}</strong>${
              p.descrizione ? `<br><span style="color:#475569;font-size:14px;">${escapeHtml(p.descrizione)}</span>` : ''
            }</li>`,
        )
        .join('')}</ol>`
    : '<p style="margin:0 0 16px 0;color:#475569;">Ordine del giorno disponibile in piattaforma.</p>';

  const contenutoHtml = `
    <p style="margin:0 0 12px 0;">${escapeHtml(saluto)}</p>
    <p style="margin:0 0 16px 0;">è convocata l'<strong>Assemblea ${escapeHtml(tipoLabel)}</strong> del condominio <strong>${escapeHtml(dati.condominioNome)}</strong>.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background-color:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:16px;">
      <tr><td style="color:#475569;width:42%;">1ª Convocazione</td><td style="font-weight:600;">${escapeHtml(prima)}</td></tr>
      ${seconda ? `<tr><td style="color:#475569;">2ª Convocazione</td><td style="font-weight:600;">${escapeHtml(seconda)}</td></tr>` : ''}
      ${dati.luogo ? `<tr><td style="color:#475569;">Luogo</td><td>${escapeHtml(dati.luogo)}</td></tr>` : ''}
      ${dati.linkMeet ? `<tr><td style="color:#475569;">Collegamento</td><td>${escapeHtml(dati.linkMeet)}</td></tr>` : ''}
    </table>
    <h2 style="margin:0 0 8px 0;font-size:16px;color:#0D3B66;">Ordine del giorno</h2>
    ${odgHtml}
  `;

  const footer = costruisciNotaFooter(mittente);
  const textLines = [
    saluto,
    '',
    `È convocata l'Assemblea ${tipoLabel} del condominio ${dati.condominioNome}.`,
    `- 1ª Convocazione: ${prima}`,
    seconda ? `- 2ª Convocazione: ${seconda}` : null,
    dati.luogo ? `- Luogo: ${dati.luogo}` : null,
    dati.linkMeet ? `- Collegamento: ${dati.linkMeet}` : null,
    '',
    'Ordine del giorno:',
    ...(dati.puntiOdg.length
      ? dati.puntiOdg.map((p, idx) => `${p.ordine ?? idx + 1}. ${p.titolo}${p.descrizione ? ` - ${p.descrizione}` : ''}`)
      : ['Disponibile in piattaforma.']),
    '',
    footer.text,
  ].filter((l): l is string => l !== null);

  return {
    oggetto,
    htmlBody: avvolgiLayoutHtml({
      condominioNome: dati.condominioNome,
      titoloBanner: `Convocazione Assemblea ${tipoLabel}`,
      contenutoHtml,
      mittente,
    }),
    textBody: textLines.join('\n'),
  };
}

/** Genera oggetto, HTML e testo per `COMUNICAZIONE_IMPORTANTE`. */
export function generaTemplateComunicazioneImportante(
  dati: DatiTemplateComunicazione,
  mittente: MittenteAmministratore,
): EmailRenderizzata {
  const saluto = dati.destinatarioNome?.trim()
    ? `Gentile ${dati.destinatarioNome.trim()},`
    : 'Gentile Condòmino,';
  const oggetto = pulisciOggettoEmail(`[Importante] ${dati.titolo} - ${dati.condominioNome}`);
  const corpoPulito = dati.corpo?.trim() || 'Consulta i dettagli della comunicazione nell’app IoCondo.';

  const contenutoHtml = `
    <p style="margin:0 0 12px 0;">${escapeHtml(saluto)}</p>
    <p style="margin:0 0 12px 0;color:#475569;font-size:14px;">Ambito: <strong>${escapeHtml(dati.ambitoLabel)}</strong></p>
    <h2 style="margin:0 0 12px 0;font-size:18px;color:#0D3B66;">${escapeHtml(dati.titolo)}</h2>
    <div style="padding:16px;background-color:#F8FAFC;border-left:4px solid #0EA5E9;border-radius:6px;margin-bottom:16px;white-space:pre-line;">
      ${escapeHtml(corpoPulito)}
    </div>
  `;

  const footer = costruisciNotaFooter(mittente);
  const textLines = [
    saluto,
    '',
    `COMUNICAZIONE IMPORTANTE - ${dati.condominioNome} (${dati.ambitoLabel})`,
    dati.titolo,
    '',
    corpoPulito,
    '',
    footer.text,
  ];

  return {
    oggetto,
    htmlBody: avvolgiLayoutHtml({
      condominioNome: dati.condominioNome,
      titoloBanner: 'Comunicazione importante',
      contenutoHtml,
      mittente,
    }),
    textBody: textLines.join('\n'),
  };
}

/** Calcola i totali riepilogativi per le 3 StatCard della vista Log & Coda Email. */
export function calcolaRiepilogoCoda(righe: ReadonlyArray<Pick<ICodaEmail, 'stato'>>): RiepilogoCodaEmail {
  let inAttesa = 0;
  let inviate = 0;
  let fallite = 0;
  for (const r of righe) {
    if (r.stato === 'PENDING' || r.stato === 'PROCESSING') inAttesa++;
    else if (r.stato === 'SENT') inviate++;
    else if (r.stato === 'FAILED') fallite++;
  }
  return {
    totali: righe.length,
    inAttesa,
    inviate,
    fallite,
  };
}

/** Filtra le righe della coda email per stato, tipo evento e testo libero. */
export function filtraCodaEmail<
  T extends Pick<ICodaEmail, 'stato' | 'tipo_evento' | 'destinatario_email' | 'destinatario_nome' | 'oggetto'>,
>(
  righe: readonly T[],
  filtri: {
    stato?: 'TUTTI' | 'IN_ATTESA' | 'SENT' | 'FAILED';
    tipoEvento?: 'TUTTI' | TipoEventoEmail;
    search?: string;
  },
): T[] {
  const q = (filtri.search ?? '').trim().toLowerCase();
  return righe.filter((r) => {
    if (filtri.stato === 'IN_ATTESA' && r.stato !== 'PENDING' && r.stato !== 'PROCESSING') return false;
    if (filtri.stato === 'SENT' && r.stato !== 'SENT') return false;
    if (filtri.stato === 'FAILED' && r.stato !== 'FAILED') return false;
    if (filtri.tipoEvento && filtri.tipoEvento !== 'TUTTI' && r.tipo_evento !== filtri.tipoEvento) return false;
    if (q) {
      const hay = `${r.destinatario_email} ${r.destinatario_nome ?? ''} ${r.oggetto}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function etichettaTipoEventoEmail(tipo: TipoEventoEmail): string {
  switch (tipo) {
    case 'BOLLETTINO_EMESSO':
      return 'Bollettino';
    case 'CONVOCAZIONE_ASSEMBLEA':
      return 'Assemblea';
    case 'COMUNICAZIONE_IMPORTANTE':
      return 'Comunicazione';
  }
}

export function etichettaStatoCodaEmail(stato: StatoCodaEmail): string {
  switch (stato) {
    case 'PENDING':
      return 'In attesa';
    case 'PROCESSING':
      return 'In invio';
    case 'SENT':
      return 'Inviata';
    case 'FAILED':
      return 'Fallita';
    case 'CANCELLED':
      return 'Annullata';
  }
}
