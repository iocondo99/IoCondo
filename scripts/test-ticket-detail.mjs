import { chromium } from 'playwright';

async function testDetailAndMessage() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    storageState: 'scripts/session-portiere.json',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log('Navigazione a /ticket-aree-comuni...');
  await page.goto('http://localhost:8081/ticket-aree-comuni', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Click su "[TEST-E2E] Lampadina fulminata androne"...');
  // Usiamo il testo esatto
  await page.getByText('[TEST-E2E] Lampadina fulminata androne').click();
  await page.waitForTimeout(3000);

  console.log('Nuovo URL:', page.url());
  await page.screenshot({ path: 'scripts/reports/ticket-dettaglio-aperto.png', fullPage: true });

  const body = await page.innerText('body');
  console.log('Dettaglio include Titolo:', body.includes('[TEST-E2E] Lampadina fulminata androne'));
  console.log('Dettaglio include Area comune:', body.includes('Area comune'));

  // Invio messaggio
  console.log('Invio messaggio aggiornamento cronologia...');
  const textarea = page.locator('textarea').first();
  await textarea.fill('[TEST-E2E] Verificato dal portiere: lampada sostituita con nuovo modello LED.');

  const btnInvia = page.locator('button:has-text("Invia messaggio"), [role="button"]:has-text("Invia messaggio")').first();
  await btnInvia.click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'scripts/reports/ticket-dettaglio-post-invio.png', fullPage: true });

  // Reload
  console.log('Reload pagina...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const bodyReload = await page.innerText('body');
  const msgPersistito = bodyReload.includes('lampada sostituita con nuovo modello LED');
  console.log('Messaggio cronologia persistito con successo:', msgPersistito);
  await page.screenshot({ path: 'scripts/reports/ticket-dettaglio-post-reload.png', fullPage: true });

  await browser.close();
}

testDetailAndMessage().catch(console.error);
