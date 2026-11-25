// Utility pure per la gestione email nelle Edge Functions (mittente amministratore, template HTML/testo, backoff).
// Canale di invio: SMTP Gmail (vedi inviaViaGmail in fondo al file).

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export type TipoEventoEmail = 'BOLLETTINO_EMESSO' | 'CONVOCAZIONE_ASSEMBLEA' | 'COMUNICAZIONE_IMPORTANTE';

export interface MittenteAmministratore {
  /** Nome mostrato come mittente (es. "Mario Rossi (IoCondo)"). */
  nomeVisualizzato: string;
  /**
   * Valore salvato in `coda_email.from_email`: qui è il solo display name,
   * perché la casella reale è sempre GMAIL_USER e viene imposta da inviaViaGmail.
   */
  fromEmail: string;
  /** Email reale dell'amministratore, usata come Reply-To. */
  replyToEmail: string | null;
}

export interface EmailRenderizzata {
  oggetto: string;
  htmlBody: string;
  textBody: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailValida(email: string | null | undefined): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length <= 320 && EMAIL_REGEX.test(trimmed);
}



function pulisciNomeHeader(nomeCognome?: string | null): string {
  if (typeof nomeCognome !== 'string') return 'Amministratore Condominio';
  const pulito = nomeCognome
    .replace(/[\r\n<>"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return pulito || 'Amministratore Condominio';
}


export function costruisciMittenteAmministratore(input: {
  nomeCognome?: string | null;
  email?: string | null;
}): MittenteAmministratore {
  // Il mittente reale è sempre la casella Gmail dell'app (GMAIL_USER): Gmail non
  // consente di spoofare un altro indirizzo. Conserviamo solo il nome mostrato
  // dell'amministratore e usiamo la sua email come Reply-To.
  const nome = pulisciNomeHeader(input.nomeCognome);
  const nomeVisualizzato = nome === 'Amministratore Condominio' ? nome : `${nome} (IoCondo)`;
  const replyToEmail = isEmailValida(input.email) ? input.email.trim().toLowerCase() : null;

  return {
    nomeVisualizzato,
    // Solo display name: inviaViaGmail aggiunge la casella reale <GMAIL_USER>.
    fromEmail: nomeVisualizzato,
    replyToEmail,
  };
}

export function costruisciIdempotencyKey(
  tipoEvento: TipoEventoEmail,
  riferimentoId: string,
  destinatarioEmail: string,
): string {
  return `${tipoEvento}:${riferimentoId}:${destinatarioEmail.trim().toLowerCase()}`;
}

export function calcolaProssimoTentativoIso(tentativiFalliti: number, adesso: Date = new Date()): string {
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

export function generaTemplateBollettinoEmesso(
  dati: {
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
  },
  mittente: MittenteAmministratore,
): EmailRenderizzata {
  const num = `n. ${dati.numeroProgressivo}/${dati.anno}`;
  const importo = formattaEuroDaCentesimi(dati.totaleCentesimi);
  const scadenza = formattaDataBreveIt(dati.dataScadenza);
  const saluto = dati.destinatarioNome?.trim()
    ? `Gentile ${dati.destinatarioNome.trim()},`
    : 'Gentile Condòmino,';
  const oggetto = `Bollettino ${num} emesso (${importo}) - ${dati.condominioNome}`;

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

export function generaTemplateConvocazioneAssemblea(
  dati: {
    condominioNome: string;
    destinatarioNome?: string | null;
    tipo: string;
    dataPrimaConvocazione?: string | null;
    dataSecondaConvocazione?: string | null;
    dataPrincipale: string;
    luogo?: string | null;
    linkMeet?: string | null;
    puntiOdg: Array<{ ordine: number; titolo: string; descrizione?: string | null }>;
  },
  mittente: MittenteAmministratore,
): EmailRenderizzata {
  const tipoLabel = dati.tipo === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria';
  const saluto = dati.destinatarioNome?.trim()
    ? `Gentile ${dati.destinatarioNome.trim()},`
    : 'Gentile Condòmino,';
  const oggetto = `Convocazione Assemblea ${tipoLabel} - ${dati.condominioNome}`;

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

export function generaTemplateComunicazioneImportante(
  dati: {
    condominioNome: string;
    destinatarioNome?: string | null;
    titolo: string;
    corpo?: string | null;
    ambitoLabel: string;
  },
  mittente: MittenteAmministratore,
): EmailRenderizzata {
  const saluto = dati.destinatarioNome?.trim()
    ? `Gentile ${dati.destinatarioNome.trim()},`
    : 'Gentile Condòmino,';
  const oggetto = `[Importante] ${dati.titolo} - ${dati.condominioNome}`;
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


// ---------------------------------------------------------------------------
// Invio via SMTP Gmail (denomailer) — canale unico per TUTTE le email dell'app.
// Le credenziali vivono solo come secret della funzione, mai nel client né in git:
//   GMAIL_USER          -> account Gmail dedicato (es. iocondo.noreply@gmail.com)
//   GMAIL_APP_PASSWORD  -> App Password (16 caratteri) generata da Google con 2FA attiva
//   EMAIL_FROM          -> (opzionale) mittente di default, es. "IoCondo <iocondo.noreply@gmail.com>"
// ---------------------------------------------------------------------------

export interface GmailMessaggio {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /** Mittente mostrato. Se assente usa EMAIL_FROM o GMAIL_USER. */
  from?: string;
  /** Reply-To opzionale (es. email reale dell'amministratore). */
  replyTo?: string | null;
}

interface GmailCredenziali {
  user: string;
  password: string;
  from: string;
}

/** Legge le credenziali Gmail dai secret. Senza di esse l'invio non è possibile. */
export function leggiCredenzialiGmail(): GmailCredenziali {
  const user = (Deno.env.get('GMAIL_USER') ?? '').trim();
  const password = (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').trim();
  if (!user || !password) {
    console.error('GMAIL_USER o GMAIL_APP_PASSWORD mancanti');
    throw new Error('Servizio email non configurato.');
  }
  const from = (Deno.env.get('EMAIL_FROM') ?? '').trim() || user;
  return { user, password, from };
}

/**
 * Determina l'header From effettivo. La casella reale è SEMPRE quella Gmail
 * autenticata (GMAIL_USER / EMAIL_FROM): Gmail non consente di inviare da un
 * altro indirizzo. Se `from` è un semplice display name (senza <indirizzo>),
 * lo si abbina alla casella reale -> `Nome Mittente <casella-gmail>`.
 */
export function stripHeaderControl(value: string): string {
  return value.replace(/[\r\n\0]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function risolviFrom(from: string | undefined, fallbackReale: string): string {
  const fallbackPulito = stripHeaderControl(fallbackReale);
  const v = stripHeaderControl(from ?? '');
  if (!v) return fallbackPulito;
  // Estrae la casella reale dal fallback (puo' essere "Nome <casella>" o "casella").
  const match = fallbackPulito.match(/<([^>]+)>/);
  const casella = stripHeaderControl(match ? match[1]! : fallbackPulito);
  if (v.includes('<') && v.includes('>')) {
    const inner = v.match(/<([^>]+)>/);
    const addr = stripHeaderControl(inner?.[1] ?? '');
    if (isEmailValida(addr)) {
      const displayPart = stripHeaderControl(v.slice(0, v.indexOf('<')).replace(/["<>]/g, ''));
      return displayPart ? `${displayPart} <${addr}>` : addr;
    }
    return fallbackPulito;
  }
  const nomePulito = stripHeaderControl(v.replace(/[<>"]/g, ''));
  return nomePulito ? `${nomePulito} <${casella}>` : fallbackPulito;
}

/**
 * Invia una singola email via SMTP Gmail (TLS, porta 465). Apre e chiude la
 * connessione per invocazione. Rilancia in caso di errore così il chiamante
 * può gestire retry/stato. Nessun dato personale nei log.
 */
/**
 * Toglie spazi a fine riga e righe vuote: con la codifica quoted-printable dell'invio diventerebbero
 * "=20" visibili nel messaggio.
 */
function compattaRighe(testo: string): string {
  return testo
    .split(/\r?\n/)
    .map((riga) => riga.replace(/[ \t]+$/g, ''))
    .filter((riga, i, tutte) => riga.trim() !== '' || (i > 0 && tutte[i - 1]!.trim() !== ''))
    .join('\n')
    .trim();
}

function compattaHtml(html: string): string {
  return html
    .split(/\r?\n/)
    .map((riga) => riga.trim())
    .filter((riga) => riga !== '')
    .join('\n');
}

export async function inviaViaGmail(
  messaggio: GmailMessaggio,
  credenziali: GmailCredenziali = leggiCredenzialiGmail(),
): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: credenziali.user, password: credenziali.password },
    },
  });

  try {
    const toPulito = stripHeaderControl(messaggio.to).toLowerCase();
    if (!isEmailValida(toPulito)) {
      throw new Error('Destinatario email non valido');
    }
    const subjectPulito = stripHeaderControl(messaggio.subject);
    if (!subjectPulito) {
      throw new Error('Oggetto email non valido');
    }
    const replyToPulito = messaggio.replyTo ? stripHeaderControl(messaggio.replyTo).toLowerCase() : undefined;
    if (replyToPulito && !isEmailValida(replyToPulito)) {
      throw new Error('Reply-To non valido');
    }

    await client.send({
      from: risolviFrom(messaggio.from, credenziali.from),
      to: toPulito,
      subject: subjectPulito,
      // denomailer: 'content' per il testo, 'html' per la versione HTML.
      content: compattaRighe(messaggio.text ?? "Questa email richiede un client che supporti l'HTML."),
      ...(messaggio.html ? { html: compattaHtml(messaggio.html) } : {}),
      ...(replyToPulito ? { replyTo: replyToPulito } : {}),
    });
  } finally {
    try {
      await client.close();
    } catch {
      /* chiusura best-effort */
    }
  }
}
