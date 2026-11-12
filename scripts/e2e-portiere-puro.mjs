import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.APP_URL || (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : 'http://localhost:8081');
const REPORT_DIR = 'scripts/reports';
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function runPortierePuroSimulation() {
  console.log('=== AVVIO VERIFICA SIMULATA: PORTIERE PURO (solo PORTIERE) ===');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const report = {
    timestamp: new Date().toISOString(),
    scenario: 'PORTIERE PURO (senza CONDOMINO, senza ADMIN)',
    risultati: {},
    chiamateContabiliRilevate: [],
    anomalieRilevate: [],
  };

  const context = await browser.newContext({
    storageState: 'scripts/session-portiere.json',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Mock puro e deterministico di Supabase
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();

    // 1. Monitoraggio chiamate contabili proibite per il portiere
    if (url.includes('/rate') || url.includes('/rate_dettaglio') || url.includes('/movimenti_cassa') || url.includes('rateDelResidente')) {
      console.log(`[ALERT VIOLAZIONE] Rilevata chiamata contabile da portiere puro: ${url}`);
      report.chiamateContabiliRilevate.push(url);
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Access denied: accounting data is restricted' }),
      });
    }

    // 2. Mock ruoli_piattaforma
    if (url.includes('/ruoli_piattaforma')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'ruolo-portiere-id', codice: 'PORTIERE', descrizione: 'Portiere del condominio' },
          { id: 'ruolo-condomino-id', codice: 'CONDOMINO', descrizione: 'Condòmino' },
          { id: 'ruolo-admin-id', codice: 'ADMIN', descrizione: 'Amministratore' },
        ]),
      });
    }

    // 3. Mock utente_entita_ruolo: restituiamo SOLO ruolo PORTIERE
    if (url.includes('/utente_entita_ruolo')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-ruolo-portiere',
            utente_id: 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad',
            ruolo_id: 'ruolo-portiere-id',
            condominio_id: 'c1-test-id',
            unita_id: null,
          },
        ]),
      });
    }

    // 4. Mock condomini amministrati da admin_id: vuoto
    if (url.includes('/condomini?') && url.includes('admin_id=')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // 5. Mock utenti: profilo non superadmin
    if (url.includes('/utenti?') && url.includes('select=')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad',
          email: 'romeomatteo24@gmail.com',
          nome_cognome: 'Mario Portiere',
          telefono: '3331234567',
          avatar_url: null,
          is_superadmin: false,
        }),
      });
    }

    // 6. Mock condomini per id
    if (url.includes('/condomini?') && url.includes('in=(')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'c1-test-id',
            nome: 'Condominio di Prova',
            indirizzo: 'Via dei Test 1',
            citta: 'Cittadiprova',
          },
        ]),
      });
    }

    // 7. Mock configurazioni_condominio
    if (url.includes('/configurazioni_condominio')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          condominio_id: 'c1-test-id',
          abilita_chat: true,
          abilita_bacheca: true,
          abilita_ticket: true,
          abilita_pacchi: true,
        }),
      });
    }

    // 8. Mock comunicazioni
    if (url.includes('/comunicazioni')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // 9. Mock notifiche
    if (url.includes('/notifiche')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // 10. Mock pacchi
    if (url.includes('/pacchi')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // 11. Mock ticket / segnalazioni
    if (url.includes('/ticket') || url.includes('/segnalazioni')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // 12. Mock assemblee
    if (url.includes('/assemblee')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // 13. Mock documenti
    if (url.includes('/documenti')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // -------------------------------------------------------------
  // TEST 1: Sidebar Desktop 1440x900
  // -------------------------------------------------------------
  console.log('\n--- 1. Verifica Sidebar Desktop per Portiere Puro (1440x900) ---');
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${REPORT_DIR}/portiere-puro-01-home.png`, fullPage: true });

  const sidebarLinks = await page.locator('aside a, nav a').allInnerTexts();
  const cleanedSidebar = sidebarLinks.map(s => s.trim()).filter(Boolean);
  console.log('Sidebar Portiere Puro:', cleanedSidebar);

  const haSpese = cleanedSidebar.includes('Spese');
  const haPagamenti = cleanedSidebar.includes('Pagamenti');
  const haSegnalazioni = cleanedSidebar.includes('Segnalazioni');
  const haPacchi = cleanedSidebar.includes('Registro pacchi');
  const haTicket = cleanedSidebar.includes('Ticket aree comuni');

  report.risultati.sidebarDesktop = {
    voci: cleanedSidebar,
    speseAssente: !haSpese,
    pagamentiAssente: !haPagamenti,
    registroPacchiPresente: haPacchi,
    ticketAreeComuniPresente: haTicket,
    segnalazioniAssente: !haSegnalazioni,
  };

  if (haSpese) report.anomalieRilevate.push('La voce Spese è visibile al portiere puro nella sidebar!');
  if (haPagamenti) report.anomalieRilevate.push('La voce Pagamenti è visibile al portiere puro nella sidebar!');
  if (haSegnalazioni) report.anomalieRilevate.push('La voce Segnalazioni (private per condòmino) è visibile al portiere puro nella sidebar!');

  // -------------------------------------------------------------
  // TEST 2: Barra Mobile 390x844
  // -------------------------------------------------------------
  console.log('\n--- 2. Verifica Barra Mobile per Portiere Puro (390x844) ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/portiere-puro-02-mobile.png` });

  const bottomLinks = await page.locator('nav[aria-label*="inferiore" i] a, footer a, [role="tablist"] a, [role="navigation"] a').allInnerTexts();
  const cleanedBottom = bottomLinks.map(s => s.trim()).filter(Boolean);
  console.log('Barra mobile Portiere Puro:', cleanedBottom);

  const pacchiInBarra = cleanedBottom.some(t => t.toLowerCase().includes('pacchi'));
  const speseInBarra = cleanedBottom.some(t => t.toLowerCase().includes('spese'));

  report.risultati.mobile = {
    vociBarra: cleanedBottom,
    pacchiPromossoInBarra: pacchiInBarra,
    speseAssenteDallaBarra: !speseInBarra,
  };

  if (!pacchiInBarra) {
    report.anomalieRilevate.push('Registro pacchi NON è presente direttamente nella barra mobile a 4 voci del portiere puro!');
  }

  // -------------------------------------------------------------
  // TEST 3: Isolamento Contabile (Accesso diretto a rotte protette)
  // -------------------------------------------------------------
  console.log('\n--- 3. Verifica Isolamento Contabile su rotte protette ---');
  await page.setViewportSize({ width: 1440, height: 900 });

  const rotteContabili = ['/spese', '/spese/123', '/pagamenti', '/pagamenti/123'];
  report.risultati.isolamentoContabile = {};

  for (const rotta of rotteContabili) {
    await page.goto(`${BASE_URL}${rotta}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const body = await page.innerText('body');
    const screenshot = `${REPORT_DIR}/portiere-puro-guardia-${rotta.replace(/\//g, '_')}.png`;
    await page.screenshot({ path: screenshot });

    const bloccato = body.includes('Non autorizzato') ||
                     body.includes('Questa funzione non è disponibile') ||
                     body.includes('Accesso non consentito') ||
                     page.url().includes('/home');

    report.risultati.isolamentoContabile[rotta] = {
      url: page.url(),
      bloccato,
      haNonAutorizzato: body.includes('Non autorizzato') || body.includes('Questa funzione non è disponibile'),
    };
    console.log(`Rotta contabile ${rotta} -> Bloccato: ${bloccato}`);
    if (!bloccato) {
      report.anomalieRilevate.push(`La rotta contabile ${rotta} NON è bloccata per il portiere puro!`);
    }
  }

  // -------------------------------------------------------------
  // TEST 4: Home Portiere Puro e Segnalazioni Rapide
  // -------------------------------------------------------------
  console.log('\n--- 4. Verifica Home e Segnalazioni Rapide Portiere Puro ---');
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const homeText = await page.innerText('body');
  
  const haCardSpese = homeText.includes('Spese e scadenze') || homeText.includes('Vedi le rate');
  const haSegnalazioniRapide = homeText.includes('Segnalazioni rapide');
  console.log('Home Portiere Puro: Card Spese presente?', haCardSpese, '| Segnalazioni rapide presente?', haSegnalazioniRapide);

  report.risultati.home = {
    cardSpeseAssente: !haCardSpese,
    haSegnalazioniRapide,
    chiamateContabiliPartite: report.chiamateContabiliRilevate.length,
  };

  if (haCardSpese) {
    report.anomalieRilevate.push('La StatCard Spese e scadenze è visibile nella Home del portiere puro!');
  }
  if (report.chiamateContabiliRilevate.length > 0) {
    report.anomalieRilevate.push(`Sono partite ${report.chiamateContabiliRilevate.length} chiamate contabili dal profilo portiere puro!`);
  }

  // Clic su "Nuova segnalazione" dalla card Segnalazioni rapide nella Home
  const btnNuovaSegnalazioneHome = page.locator('button:has-text("Nuova segnalazione"), [role="button"]:has-text("Nuova segnalazione")').first();
  if (await btnNuovaSegnalazioneHome.isVisible()) {
    console.log('Click su Nuova segnalazione in Home...');
    await btnNuovaSegnalazioneHome.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${REPORT_DIR}/portiere-puro-03-modale-home.png` });

    const modaleText = await page.innerText('[role="dialog"], body');
    const isModalitaPortiere = modaleText.includes('Nuovo ticket su area comune') || modaleText.includes('area comune del condominio');
    console.log('Modale aperta in modalità Portiere (area comune):', isModalitaPortiere);
    report.risultati.home.modaleInModalitaPortiere = isModalitaPortiere;

    if (!isModalitaPortiere) {
      report.anomalieRilevate.push('La card Segnalazioni rapide in Home non ha aperto il modulo in modalità portiere (area comune)!');
    }
  }

  // -------------------------------------------------------------
  // TEST 5: Controllo incrociato: Condòmino Puro in /pacchi
  // -------------------------------------------------------------
  console.log('\n--- 5. Controllo incrociato: Condòmino Puro in /pacchi ---');
  await page.unroute('**/rest/v1/**');
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/ruoli_piattaforma')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'ruolo-condomino-id', codice: 'CONDOMINO', descrizione: 'Condòmino' },
        ]),
      });
    }
    if (url.includes('/utente_entita_ruolo')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-ruolo-condomino',
            utente_id: 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad',
            ruolo_id: 'ruolo-condomino-id',
            condominio_id: 'c1-test-id',
            unita_id: 'u1-test-id',
          },
        ]),
      });
    }
    if (url.includes('/condomini?') && url.includes('in=(')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'c1-test-id', nome: 'Condominio di Prova', indirizzo: 'Via Test 1', citta: 'Città' },
        ]),
      });
    }
    if (url.includes('/utenti?') && url.includes('select=')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad',
          email: 'romeomatteo24@gmail.com',
          nome_cognome: 'Gianni Condomino',
          telefono: null,
          avatar_url: null,
          is_superadmin: false,
        }),
      });
    }
    if (url.includes('/pacchi')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'pacco-test-1',
            condominio_id: 'c1-test-id',
            unita_id: 'u1-test-id',
            data_arrivo: new Date().toISOString(),
            stato: 'GIACENZA',
            firma_ritiro: null,
            data_ritiro: null,
            unita_immobiliari: { id: 'u1-test-id', interno: '1', palazzi: { nome: 'Palazzo A' } },
          },
        ]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto(`${BASE_URL}/pacchi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${REPORT_DIR}/condomino-puro-pacchi.png`, fullPage: true });

  const btnRegistraArrivo = page.locator('button:has-text("Registra arrivo pacco"), [role="button"]:has-text("Registra arrivo pacco")').first();
  const haBtnRegistra = await btnRegistraArrivo.isVisible();
  const btnConsegna = page.locator('button:has-text("Consegna"), [role="button"]:has-text("Consegna")').first();
  const haBtnConsegna = await btnConsegna.isVisible();

  console.log('Condòmino puro in /pacchi: ha pulsante Registra arrivo?', haBtnRegistra, '| ha pulsante Consegna?', haBtnConsegna);
  report.risultati.condominoPuroPacchi = {
    haPulsanteRegistraArrivo: haBtnRegistra,
    haPulsanteConsegna: haBtnConsegna,
    sicuroSolaLettura: !haBtnRegistra && !haBtnConsegna,
  };

  if (haBtnRegistra) {
    report.anomalieRilevate.push('Un condòmino puro può vedere il pulsante Registra arrivo pacco in /pacchi!');
  }
  if (haBtnConsegna) {
    report.anomalieRilevate.push('Un condòmino puro può vedere il pulsante Consegna pacco in /pacchi!');
  }

  // Salvataggio Report
  fs.writeFileSync(`${REPORT_DIR}/report-portiere-puro-simulato.json`, JSON.stringify(report, null, 2));
  console.log(`\nReport Portiere Puro Simulato salvato in ${REPORT_DIR}/report-portiere-puro-simulato.json`);

  await browser.close();
  console.log('=== VERIFICA PORTIERE PURO SIMULATO COMPLETATA ===');
}

runPortierePuroSimulation().catch(err => {
  console.error('Errore durante verifica portiere puro simulato:', err);
  process.exit(1);
});
