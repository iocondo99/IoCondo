import { chromium } from 'playwright';

async function performLogin() {
  console.log('Avvio Edge per login...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]`, msg.text());
  });

  console.log('Navigazione a http://localhost:8081/login...');
  await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Pagina corrente:', page.url());
  await page.screenshot({ path: 'scripts/reports/00-login-screen.png' });

  // Compilazione campi
  console.log('Compilazione credenziali...');
  const emailInput = page.locator('input[type="email"], input[placeholder="nome@esempio.it"], input[type="text"]').first();
  await emailInput.fill('romeomatteo24@gmail.com');

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill('MatyRomy_99');

  console.log('Click pulsante Accedi...');
  const submitButton = page.locator('button:has-text("Accedi"), [role="button"]:has-text("Accedi")').first();
  await submitButton.click();

  console.log('Attesa reindirizzamento post-login...');
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('URL post-login:', page.url());
  await page.screenshot({ path: 'scripts/reports/00-post-login.png' });

  // Salvataggio storageState
  await context.storageState({ path: 'scripts/session-portiere.json' });
  console.log('Sessione salvata con successo in scripts/session-portiere.json');

  await browser.close();
}

performLogin().catch(err => {
  console.error('Errore durante performLogin:', err);
  process.exit(1);
});
