import { chromium } from 'playwright';

async function inspectTicketTable() {
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
  await page.goto(`${BASE_URL}/ticket-aree-comuni`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const text = await page.innerText('body');
  console.log('Testo completo di /ticket-aree-comuni:\n', text);

  await page.screenshot({ path: 'scripts/reports/ticket-inspect-table.png', fullPage: true });

  await browser.close();
}

inspectTicketTable().catch(console.error);
