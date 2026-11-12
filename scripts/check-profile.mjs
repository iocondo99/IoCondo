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

  const BASE_URL = process.env.APP_URL || (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : 'http://localhost:8081');
  console.log(`Navigazione a ${BASE_URL}/home...`);
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
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
