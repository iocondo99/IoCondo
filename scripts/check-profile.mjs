import { chromium } from 'playwright';

async function checkProfile() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    storageState: 'scripts/session-portiere.json',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log('Navigazione a http://localhost:8081/home...');
  await page.goto('http://localhost:8081/home', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('URL attuale:', page.url());

  const title = await page.innerText('body');
  console.log('Contenuto estratto (primi 500 car):', title.slice(0, 500).replace(/\n+/g, ' '));

  // Controlliamo se c'è un selettore di vista o di ruolo
  const vistaSelector = await page.locator('text=Vista, text=Condòmino, text=Amministratore').allInnerTexts();
  console.log('Elementi vista:', vistaSelector);

  await page.screenshot({ path: 'scripts/reports/check-home.png', fullPage: true });

  await browser.close();
}

checkProfile().catch(console.error);
