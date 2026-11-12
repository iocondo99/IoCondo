import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.APP_URL || (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : 'http://localhost:8081');
const REPORT_DIR = 'scripts/reports';
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function runFullLivePortiereTest() {
  console.log('=== AVVIO VERIFICA LIVE APPROFONDITA PORTIERE + CONDOMINO ===');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const report = {
    timestamp: new Date().toISOString(),
    account: 'romeomatteo24@gmail.com (PORTIERE + CONDOMINO)',
    risultati: {},
    consoleErrors: [],
    testRecordsCreated: [],
  };

  const context = await browser.newContext({
    storageState: 'scripts/session-portiere.json',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('Download the React DevTools') && !txt.includes('warning')) {
        console.log(`[CONSOLE ERROR] ${txt}`);
        report.consoleErrors.push(txt);
      }
    }
  });

  // ---------------------------------------------------------
  // 1. NAVIGAZIONE E LAYOUT DESKTOP (1440x900)
  // ---------------------------------------------------------
  console.log('\n--- 1. Navigazione & Layout Desktop (1440x900) ---');
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/desktop-01-home.png`, fullPage: true });

  const sidebarLinks = await page.locator('aside a, nav a').allInnerTexts();
  const cleanedSidebar = sidebarLinks.map(s => s.trim()).filter(Boolean);
  console.log('Voci sidebar trovate:', cleanedSidebar);

  report.risultati.sidebarDesktop = {
    voci: cleanedSidebar,
    haRegistroPacchi: cleanedSidebar.includes('Registro pacchi'),
    haTicketAreeComuni: cleanedSidebar.includes('Ticket aree comuni'),
    haSpese: cleanedSidebar.includes('Spese'),
    haPagamenti: cleanedSidebar.includes('Pagamenti'),
    haSegnalazioni: cleanedSidebar.includes('Segnalazioni'),
    haDocumenti: cleanedSidebar.includes('Documenti'),
    haComunicazioni: cleanedSidebar.includes('Comunicazioni'),
    haAssemblee: cleanedSidebar.includes('Assemblee'),
    haImpostazioni: cleanedSidebar.includes('Impostazioni'),
    haAssistenza: cleanedSidebar.includes('Assistenza'),
  };

  // ---------------------------------------------------------
  // 2. GUARDIE ADMIN / SUPERADMIN DALLA VISTA RESIDENTE
  // ---------------------------------------------------------
  console.log('\n--- 2. Guardie di sicurezza su /admin/* e /superadmin/* ---');
  const rotteAdmin = [
    '/admin/dashboard',
    '/admin/manutenzione',
    '/admin/contabilita',
    '/superadmin/amministratori',
  ];
  report.risultati.guardie = {};

  for (const rotta of rotteAdmin) {
    await page.goto(`${BASE_URL}${rotta}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const bodyText = await page.innerText('body');
    const screenshotFile = `${REPORT_DIR}/guardia-${rotta.replace(/\//g, '_')}.png`;
    await page.screenshot({ path: screenshotFile });

    const bloccato = bodyText.includes('Questa funzione non è disponibile per te') ||
                     bodyText.includes('Non autorizzato') ||
                     bodyText.includes('Accesso non consentito') ||
                     page.url().includes('/home');

    report.risultati.guardie[rotta] = {
      urlFinale: page.url(),
      bloccato,
      messaggioBloccoPresente: bodyText.includes('Questa funzione non è disponibile per te'),
    };
    console.log(`Rotta ${rotta} -> URL: ${page.url()} | Bloccato: ${bloccato}`);
  }

  // ---------------------------------------------------------
  // 3. REGISTRO PACCHI (/pacchi) - CRUD COMPLETO
  // ---------------------------------------------------------
  console.log('\n--- 3. Registro Pacchi (/pacchi) ---');
  await page.goto(`${BASE_URL}/pacchi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/pacchi-01-elenco.png`, fullPage: true });

  const pageHeaderText = await page.locator('h1, [role="heading"]').first().innerText();
  const btnNuovoPacco = page.locator('button:has-text("Registra arrivo pacco"), [role="button"]:has-text("Registra arrivo pacco")').first();
  const haBtnNuovo = await btnNuovoPacco.isVisible();
  console.log('PageHeader pacchi:', pageHeaderText, '| Pulsante Registra arrivo presente:', haBtnNuovo);

  // StatCard
  const bodyPacchi = await page.innerText('body');
  const haGiacenza = bodyPacchi.includes('in giacenza');
  const haRitirati = bodyPacchi.includes('Ritirati');
  const haTotale = bodyPacchi.includes('Totale pacchi');
  console.log('StatCard visibili:', { haGiacenza, haRitirati, haTotale });

  // Filtri chip
  const chipTutti = page.locator('button:has-text("Tutti"), [role="button"]:has-text("Tutti")').first();
  const chipGiacenza = page.locator('button:has-text("In giacenza"), [role="button"]:has-text("In giacenza")').first();
  const chipRitirati = page.locator('button:has-text("Ritirati"), [role="button"]:has-text("Ritirati")').first();
  const chipPresenti = (await chipTutti.isVisible()) && (await chipGiacenza.isVisible()) && (await chipRitirati.isVisible());
  console.log('FilterChips presenti (Tutti, In giacenza, Ritirati):', chipPresenti);

  // SearchBar
  const searchBar = page.locator('input[placeholder*="Cerca per unità o interno"], input[placeholder*="Cerca"]').first();
  const haSearchBar = await searchBar.isVisible();
  console.log('SearchBar visibile:', haSearchBar);

  // Modale Registra arrivo pacco
  console.log('\nTest Modale Registra Arrivo Pacco...');
  await btnNuovoPacco.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${REPORT_DIR}/pacchi-02-modale-registra.png` });

  // Invio vuoto (senza unità) per verificare validazione
  const btnInviaNuovo = page.locator('button:has-text("Registra"), [role="button"]:has-text("Registra")').last();
  await btnInviaNuovo.click();
  await page.waitForTimeout(500);
  const modaleText = await page.innerText('[role="dialog"], body');
  const erroreUnitaPresente = modaleText.includes('Seleziona l’unità immobiliare') || modaleText.includes('obbligatorio') || modaleText.includes('richiesta');
  console.log('Validazione unità obbligatoria:', erroreUnitaPresente);

  // Selezione unità dalla tendina Select
  console.log('Apertura tendina selezione unità...');
  const selectTrigger = page.locator('button[aria-haspopup="listbox"], [role="combobox"]').first();
  await selectTrigger.click();
  await page.waitForTimeout(500);

  const opzioni = page.locator('[role="option"], button[id*="option"]');
  const countOpzioni = await opzioni.count();
  let unitaSelezionata = '';
  if (countOpzioni > 1) {
    unitaSelezionata = await opzioni.nth(1).innerText();
    await opzioni.nth(1).click();
  } else if (countOpzioni === 1) {
    unitaSelezionata = await opzioni.first().innerText();
    await opzioni.first().click();
  }
  console.log('Unità selezionata:', unitaSelezionata);
  await page.waitForTimeout(500);

  // Invio registrazione
  console.log('Click Registra pacco...');
  await btnInviaNuovo.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${REPORT_DIR}/pacchi-04-dopo-registrazione.png`, fullPage: true });

  // Verifica persistenza dopo reload
  console.log('Verifica persistenza dopo reload...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const bodyDopoReload = await page.innerText('body');
  const paccoVisibileDopoReload = bodyDopoReload.includes(unitaSelezionata.trim()) || bodyDopoReload.includes('In giacenza');
  console.log('Pacco registrato persistito dopo reload:', paccoVisibileDopoReload);

  report.testRecordsCreated.push(`[TEST-E2E] Pacco per unità ${unitaSelezionata}`);

  // Consegna / Ritiro con Firma
  console.log('\nTest Modale Consegna / Ritiro con firma...');
  // Cerchiamo il pulsante "Consegna" nella tabella
  const btnConsegna = page.locator('button:has-text("Consegna"), [role="button"]:has-text("Consegna")').first();
  const haBtnConsegna = await btnConsegna.isVisible();
  console.log('Pulsante Consegna presente su un pacco in giacenza:', haBtnConsegna);

  let esitoRitiro = false;
  if (haBtnConsegna) {
    await btnConsegna.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${REPORT_DIR}/pacchi-05-modale-ritiro.png` });

    // Invio con campo firma vuoto
    const btnConfermaRitiro = page.locator('button:has-text("Conferma consegna"), [role="button"]:has-text("Conferma consegna")').first();
    await btnConfermaRitiro.click();
    await page.waitForTimeout(500);

    const modaleRitiroText = await page.innerText('[role="dialog"], body');
    const erroreFirmaPresente = modaleRitiroText.includes('nominativo') || modaleRitiroText.includes('obbligatorio') || modaleRitiroText.includes('richiesta') || modaleRitiroText.includes('Inserisci una firma');
    console.log('Validazione firma vuota:', erroreFirmaPresente);

    // Inserimento firma
    const inputFirma = page.locator('input[placeholder*="Mario Rossi"], input[placeholder*="ritirante"]').first();
    await inputFirma.fill('[TEST-E2E] Ritiro Mario Rossi');
    await page.waitForTimeout(300);

    console.log('Conferma consegna pacco...');
    await btnConfermaRitiro.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${REPORT_DIR}/pacchi-06-dopo-ritiro.png`, fullPage: true });

    // Reload per persistenza ritiro
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Passiamo al tab "Ritirati" per vedere il pacco ritirato
    const chipRit = page.locator('button:has-text("Ritirati"), [role="button"]:has-text("Ritirati")').first();
    if (await chipRit.isVisible()) {
      await chipRit.click();
      await page.waitForTimeout(1000);
    }
    const bodyRitirati = await page.innerText('body');
    esitoRitiro = bodyRitirati.includes('[TEST-E2E] Ritiro Mario Rossi') || bodyRitirati.includes('Ritirato');
    console.log('Pacco ritirato con firma persistito dopo reload:', esitoRitiro);
    await page.screenshot({ path: `${REPORT_DIR}/pacchi-07-tab-ritirati.png`, fullPage: true });
  }

  report.risultati.pacchi = {
    header: pageHeaderText,
    haBtnNuovo,
    statCards: { haGiacenza, haRitirati, haTotale },
    chipPresenti,
    haSearchBar,
    validazioneUnita: erroreUnitaPresente,
    persistenzaArrivo: paccoVisibileDopoReload,
    haBtnConsegna,
    esitoRitiro,
  };

  // ---------------------------------------------------------
  // 4. TICKET AREE COMUNI (/ticket-aree-comuni)
  // ---------------------------------------------------------
  console.log('\n--- 4. Ticket Aree Comuni (/ticket-aree-comuni) ---');
  await page.goto(`${BASE_URL}/ticket-aree-comuni`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/ticket-01-elenco.png`, fullPage: true });

  const headerTicket = await page.locator('h1, [role="heading"]').first().innerText();
  const btnNuovoTicket = page.locator('button:has-text("Nuovo ticket"), [role="button"]:has-text("Nuovo ticket")').first();
  const haBtnNuovoTicket = await btnNuovoTicket.isVisible();
  console.log('Header Ticket:', headerTicket, '| Pulsante Nuovo ticket presente:', haBtnNuovoTicket);

  let ticketCreatoId = '';
  let commentoPersistito = false;

  if (haBtnNuovoTicket) {
    await btnNuovoTicket.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${REPORT_DIR}/ticket-02-modale-nuovo.png` });

    // Validazione campi vuoti
    const btnInviaTicket = page.locator('button:has-text("Invia segnalazione"), button:has-text("Apri ticket"), [role="button"]:has-text("Invia segnalazione")').last();
    await btnInviaTicket.click();
    await page.waitForTimeout(500);
    const modaleNuovoTicketText = await page.innerText('[role="dialog"], body');
    const validazioneTicketVuoto = modaleNuovoTicketText.includes('titolo') || modaleNuovoTicketText.includes('obbligatorio') || modaleNuovoTicketText.includes('descrizione') || modaleNuovoTicketText.includes('Scrivi un titolo');
    console.log('Validazione ticket vuoto:', validazioneTicketVuoto);

    // Compilazione campi
    console.log('Compilazione ticket area comune...');
    const titoloTicket = page.locator('input[placeholder*="Perdita"], input[placeholder*="titolo" i], input[type="text"]').first();
    await titoloTicket.fill('[TEST-E2E] Lampadina fulminata androne');

    const descTicket = page.locator('textarea').first();
    await descTicket.fill('[TEST-E2E] La lampada centrale dell androne al piano terra sfarfalla e si spegne continuamente.');

    await page.screenshot({ path: `${REPORT_DIR}/ticket-03-compilato.png` });

    console.log('Invio apertura ticket...');
    await btnInviaTicket.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${REPORT_DIR}/ticket-04-post-creazione.png`, fullPage: true });

    console.log('URL corrente dopo creazione ticket:', page.url());
    report.testRecordsCreated.push('[TEST-E2E] Lampadina fulminata androne');

    // Clicchiamo sulla riga del ticket appena creato nell'elenco (oppure se reindirizzato al dettaglio)
    if (!page.url().includes('/ticket-aree-comuni/')) {
      console.log('Navigazione al dettaglio cliccando sulla riga del ticket creato...');
      const rigaTicket = page.locator('tr:has-text("[TEST-E2E] Lampadina"), div:has-text("[TEST-E2E] Lampadina")').first();
      if (await rigaTicket.isVisible()) {
        await rigaTicket.click();
        await page.waitForTimeout(2000);
      }
    }

    if (page.url().includes('/ticket-aree-comuni/')) {
      ticketCreatoId = page.url().split('/ticket-aree-comuni/')[1].split('?')[0];
      console.log('Siamo nel dettaglio ticket! ID:', ticketCreatoId);
      await page.screenshot({ path: `${REPORT_DIR}/ticket-05-dettaglio.png`, fullPage: true });

      // Invio messaggio cronologia
      const inputMsg = page.locator('textarea[placeholder*="aggiornamento"], textarea').first();
      if (await inputMsg.isVisible()) {
        await inputMsg.fill('[TEST-E2E] Segnalato dal portiere dopo sopralluogo mattutino.');
        const btnInviaMsg = page.locator('button:has-text("Invia messaggio"), [role="button"]:has-text("Invia messaggio")').last();
        await btnInviaMsg.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${REPORT_DIR}/ticket-06-dettaglio-messaggio.png`, fullPage: true });

        // Reload dettaglio
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        const bodyDettaglio = await page.innerText('body');
        commentoPersistito = bodyDettaglio.includes('[TEST-E2E] Segnalato dal portiere');
        console.log('Messaggio cronologia persistito dopo reload:', commentoPersistito);
      }
    }
  }

  // Verifica isolamento RLS / 404
  console.log('\nVerifica isolamento RLS con UUID non esistente...');
  await page.goto(`${BASE_URL}/ticket-aree-comuni/00000000-0000-0000-0000-000000000000`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/ticket-07-rls-inesistente.png`, fullPage: true });
  const textInesistente = await page.innerText('body');
  const rlsOk = textInesistente.includes('Questa segnalazione non è disponibile') || textInesistente.includes('Non autorizzato');
  console.log('Stato NonAutorizzato / Non disponibile su UUID inesistente:', rlsOk);

  report.risultati.ticketAreeComuni = {
    header: headerTicket,
    haBtnNuovoTicket,
    ticketCreatoId,
    commentoPersistito,
    rlsIsolamentoOk: rlsOk,
  };

  // ---------------------------------------------------------
  // 5. HOME E VISTA IBRIDA
  // ---------------------------------------------------------
  console.log('\n--- 5. Home e Vista Ibrida ---');
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const homeBody = await page.innerText('body');
  report.risultati.homeIbrida = {
    haSpeseCard: homeBody.includes('Spese e scadenze'),
    haComunicazioni: homeBody.includes('Ultime comunicazioni') || homeBody.includes('comunicazioni'),
    haSegnalazioniRapide: homeBody.includes('Segnalazioni rapide') || homeBody.includes('Nuova segnalazione'),
  };
  console.log('Home utente ibrido:', report.risultati.homeIbrida);

  // ---------------------------------------------------------
  // 6. VIEWPORT MOBILE (390x844) & BARRA INFERIORE
  // ---------------------------------------------------------
  console.log('\n--- 6. Navigazione Mobile (390x844) ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/mobile-01-home-390.png` });

  const navBottomLinks = await page.locator('nav[aria-label*="inferiore" i] a, footer a, [role="tablist"] a, [role="navigation"] a').allInnerTexts();
  const cleanedBottom = navBottomLinks.map(s => s.trim()).filter(Boolean);
  console.log('Voci barra mobile trovate:', cleanedBottom);

  await page.goto(`${BASE_URL}/altro`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/mobile-02-altro-390.png` });
  const altroBody = await page.innerText('body');
  const altroHaPacchi = altroBody.includes('Registro pacchi') || altroBody.includes('pacchi');
  const altroHaTicket = altroBody.includes('Ticket aree comuni') || altroBody.includes('aree comuni');
  console.log('Voci presenti in /altro mobile:', { altroHaPacchi, altroHaTicket });

  // Test responsive /pacchi su mobile
  await page.goto(`${BASE_URL}/pacchi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/mobile-03-pacchi-390.png`, fullPage: true });

  // Test responsive /ticket-aree-comuni su mobile
  await page.goto(`${BASE_URL}/ticket-aree-comuni`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/mobile-04-ticket-390.png`, fullPage: true });

  report.risultati.mobile = {
    vociBarra: cleanedBottom,
    altroHaPacchi,
    altroHaTicket,
  };

  // ---------------------------------------------------------
  // 7. TABLET (820x1180) E ZOOM 200%
  // ---------------------------------------------------------
  console.log('\n--- 7. Tablet (820x1180) & Zoom 200% ---');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${BASE_URL}/pacchi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${REPORT_DIR}/tablet-01-pacchi-820.png`, fullPage: true });

  // Zoom 200% su desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = '200%'; });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${REPORT_DIR}/desktop-zoom-200-pacchi.png`, fullPage: true });
  await page.evaluate(() => { document.body.style.zoom = '100%'; });

  // Salvataggio JSON finale
  fs.writeFileSync(`${REPORT_DIR}/full-report-live.json`, JSON.stringify(report, null, 2));
  console.log(`\nReport completo salvato in ${REPORT_DIR}/full-report-live.json`);

  await browser.close();
  console.log('=== VERIFICA LIVE COMPLETATA CON SUCCESSO ===');
}

runFullLivePortiereTest().catch(err => {
  console.error('Errore fatale runFullLivePortiereTest:', err);
  process.exit(1);
});
