// Utility pure per la gestione email Resend nelle Edge Functions (mittente amministratore, template HTML/testo, backoff).

export type TipoEventoEmail = 'BOLLETTINO_EMESSO' | 'CONVOCAZIONE_ASSEMBLEA' | 'COMUNICAZIONE_IMPORTANTE';

export interface MittenteAmministratore {
  nomeVisualizzato: string;
  slug: string;
  localPart: string;
  fromEmail: string;
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

export function sanitizzaSlugTesto(valore: string | null | undefined): string {
  if (typeof valore !== 'string') return '';
  return valore
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[\s_-]+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

export function sanitizzaSlugAmministratore(
  nomeCognome?: string | null,
  email?: string | null,
): string {
  const slugNome = sanitizzaSlugTesto(nomeCognome);
  if (slugNome) return slugNome;
  if (typeof email === 'string' && email.includes('@')) {
    const local = email.split('@')[0] ?? '';
    const slugEmail = sanitizzaSlugTesto(local);
    if (slugEmail) return slugEmail;
  }
  return 'amministratore';
}

function pulisciNomeHeader(nomeCognome?: string | null): string {
  if (typeof nomeCognome !== 'string') return 'Amministratore Condominio';
  const pulito = nomeCognome
    .replace(/[\r\n<>"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return pulito || 'Amministratore Condominio';
}

function pulisciDominio(domain: string): string {
  const pulito = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return pulito || 'iocondo.it';
}

export function costruisciMittenteAmministratore(input: {
  nomeCognome?: string | null;
  email?: string | null;
  senderDomain: string;
}): MittenteAmministratore {
  const nomeVisualizzato = pulisciNomeHeader(input.nomeCognome);
  const slug = sanitizzaSlugAmministratore(input.nomeCognome, input.email);
  const localPart = slug === 'amministratore' ? 'amministratore' : `amministratore.${slug}`;
  const domain = pulisciDominio(input.senderDomain);
  const replyToEmail = isEmailValida(input.email) ? input.email.trim().toLowerCase() : null;

  return {
    nomeVisualizzato,
    slug,
    localPart,
    fromEmail: `${nomeVisualizzato} <${localPart}@${domain}>`,
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
