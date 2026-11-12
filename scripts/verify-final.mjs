import { chromium } from 'playwright';

const BASE_URL = process.env.APP_URL || (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : 'http://localhost:8081');

async function verifyFinal() {
  console.log('=== VERIFICA FINALE POST-FIX ===');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    storageState: 'scripts/session-portiere.json',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // 1. Verifica utente ibrido LIVE (romeomatteo24@gmail.com): continua ad avere tutto disponibile
  console.log(`Navigazione a ${BASE_URL}/home con utente PORTIERE + CONDOMINO...`);
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const sidebarLinks = await page.locator('aside a, nav a').allInnerTexts();
  const cleaned = sidebarLinks.map(s => s.trim()).filter(Boolean);
  console.log('Voci sidebar utente ibrido:', cleaned);

  const okIbrido = cleaned.includes('Spese') && 
                    cleaned.includes('Registro pacchi') && 
                    cleaned.includes('Ticket aree comuni') &&
                    cleaned.includes('Segnalazioni');
  console.log('Tutte le voci dell utente ibrido presenti:', okIbrido);

  // 2. Verifica Portiere Puro (mock ruoli solo PORTIERE)
  console.log('\nVerifica Portiere Puro (senza CONDOMINO)...');
  await page.route('**/rest/v1/ruoli_piattaforma**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'r-portiere', codice: 'PORTIERE', descrizione: 'Portiere' },
      ]),
    });
  });

  await page.route('**/rest/v1/utente_entita_ruolo**', async route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'mock-ruolo',
          utente_id: 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad',
          ruolo_id: 'r-portiere',
          condominio_id: 'condo-id',
          unita_id: null,
        },
      ]),
    });
  });

  // Navigazione a /home con profilo solo portiere
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const sidebarPortiere = await page.locator('aside a, nav a').allInnerTexts();
  const cleanedPortiere = sidebarPortiere.map(s => s.trim()).filter(Boolean);
  console.log('Sidebar Portiere Puro post-fix:', cleanedPortiere);

  const speseAssente = !cleanedPortiere.includes('Spese');
  const pagamentiAssente = !cleanedPortiere.includes('Pagamenti');
  const segnalazioniAssente = !cleanedPortiere.includes('Segnalazioni');
  const pacchiPresente = cleanedPortiere.includes('Registro pacchi');
  const ticketPresente = cleanedPortiere.includes('Ticket aree comuni');

  console.log('Esito Portiere Puro:', {
    speseAssente,
    pagamentiAssente,
    segnalazioniAssente,
    pacchiPresente,
    ticketPresente,
  });

  // Verifica accesso diretto a /segnalazioni per il portiere puro
  console.log('Verifica guardia su /segnalazioni...');
  await page.goto(`${BASE_URL}/segnalazioni`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const textSegnalazioni = await page.innerText('body');
  const bloccatoSegnalazioni = textSegnalazioni.includes('Non autorizzato') || textSegnalazioni.includes('Questa funzione non è disponibile');
  console.log('Accesso a /segnalazioni bloccato con NonAutorizzato per il portiere puro:', bloccatoSegnalazioni);

  // Verifica accesso diretto a /segnalazioni/123 per il portiere puro
  console.log('Verifica guardia su /segnalazioni/123...');
  await page.goto(`${BASE_URL}/segnalazioni/123`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const textDettaglio = await page.innerText('body');
  const bloccatoDettaglio = textDettaglio.includes('Non autorizzato') || textDettaglio.includes('Questa funzione non è disponibile');
  console.log('Accesso a /segnalazioni/123 bloccato con NonAutorizzato per il portiere puro:', bloccatoDettaglio);

  await browser.close();
  console.log('=== VERIFICA FINALE COMPLETATA ===');
}

verifyFinal().catch(console.error);
