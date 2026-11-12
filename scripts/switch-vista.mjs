import { chromium } from 'playwright';

async function testSwitchVista() {
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
  console.log(`Navigazione a ${BASE_URL}/admin/dashboard...`);
  await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Impostiamo direttamente la preferenza nel localStorage e navighiamo a /home
  console.log('Impostazione preferenza vista RESIDENTE in localStorage...');
  await page.evaluate(() => {
    try {
      const grezzo = localStorage.getItem('iocondo.preferenze.v1');
      const pref = grezzo ? JSON.parse(grezzo) : {};
      pref.vista = 'RESIDENTE';
      localStorage.setItem('iocondo.preferenze.v1', JSON.stringify(pref));
      console.log('Preferenza impostata a RESIDENTE:', localStorage.getItem('iocondo.preferenze.v1'));
    } catch (e) {
      console.error('Errore localStorage:', e);
    }
  });

  console.log(`Navigazione a ${BASE_URL}/home...`);
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('URL corrente:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Primi 400 caratteri di /home:', bodyText.slice(0, 400).replace(/\n+/g, ' '));

  await page.screenshot({ path: 'scripts/reports/home-residente.png', fullPage: true });

  // Salvataggio storageState con la vista RESIDENTE
  await context.storageState({ path: 'scripts/session-portiere.json' });
  console.log('Sessione con vista RESIDENTE salvata in scripts/session-portiere.json');

  const links = await page.locator('aside a, nav a').allInnerTexts();
  console.log('Voci sidebar trovate in RESIDENTE:', links.map(s => s.trim()).filter(Boolean));

  await browser.close();
}

testSwitchVista().catch(console.error);
