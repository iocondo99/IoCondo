import { chromium } from 'playwright';

async function testLogin() {
  console.log('Avvio browser Edge...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  const BASE_URL = process.env.APP_URL || (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : 'http://localhost:8081');
  console.log(`Navigazione a ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  
  console.log('URL corrente:', page.url());
  const title = await page.title();
  console.log('Page title:', title);

  // Se siamo su /login, effettuiamo il login
  if (page.url().includes('/login') || (await page.$('input[type="email"]'))) {
    console.log('Compilazione form di login...');
    await page.fill('input[type="email"]', 'romeomatteo24@gmail.com');
    await page.fill('input[type="password"]', 'MatyRomy_99');
    
    // Clicca sul pulsante di login
    const loginButton = page.locator('button:has-text("Accedi"), [role="button"]:has-text("Accedi")').first();
    await loginButton.click();
    console.log('Pulsante Accedi cliccato. Attesa reindirizzamento...');

    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
    console.log('Nuovo URL dopo login:', page.url());
  }

  // Salviamo lo storage state per riutilizzarlo
  await context.storageState({ path: 'scripts/session-portiere.json' });
  console.log('Sessione salvata in scripts/session-portiere.json');

  await browser.close();
}

testLogin().catch(err => {
  console.error('Errore durante testLogin:', err);
  process.exit(1);
});
