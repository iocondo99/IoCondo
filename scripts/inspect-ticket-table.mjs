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

  await page.goto('http://localhost:8081/ticket-aree-comuni', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const text = await page.innerText('body');
  console.log('Testo completo di /ticket-aree-comuni:\n', text);

  await page.screenshot({ path: 'scripts/reports/ticket-inspect-table.png', fullPage: true });

  await browser.close();
}

inspectTicketTable().catch(console.error);
