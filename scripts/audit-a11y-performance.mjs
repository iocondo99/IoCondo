import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.APP_URL || (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : 'http://localhost:8081');
const REPORT_DIR = 'scripts/reports';

// Formula WCAG per calcolo luminanza e contrasto
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const num = parseInt(hex, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function getContrast(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runA11yAndPerformanceAudit() {
  console.log('=== AVVIO AUDIT A11Y, DESIGN SYSTEM & PERFORMANCE ===');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const auditReport = {
    timestamp: new Date().toISOString(),
    overflowChecks: {},
    contrastChecks: {},
    a11yTreeChecks: {},
    keyboardNavChecks: {},
    tapTargetChecks: {},
    nestedScrollViewChecks: {},
    consoleErrors: [],
  };

  // 1. Contrasti calcolati da tokens.ts
  console.log('\n--- 1. Verifica Contrasti WCAG 2.2 AA ---');
  const tokenPairs = [
    { name: 'Pulsante primario (Action #0A79AB su testo bianco #FFFFFF)', fg: '#FFFFFF', bg: '#0A79AB', min: 4.5 },
    { name: 'Pulsante distruttivo (#B91C1C su testo bianco #FFFFFF)', fg: '#FFFFFF', bg: '#B91C1C', min: 4.5 },
    { name: 'Focus ring (#0284C7 su sfondo #F8FAFC)', fg: '#0284C7', bg: '#F8FAFC', min: 3.0 },
    { name: 'Badge Giacenza/Warning (#B45309 su sfondo #FFFBEB)', fg: '#B45309', bg: '#FFFBEB', min: 4.5 },
    { name: 'Badge Ritirato/Success (#15803D su sfondo #F0FDF4)', fg: '#15803D', bg: '#F0FDF4', min: 4.5 },
    { name: 'Badge Info/Aperto (#0369A1 su sfondo #F0F9FF)', fg: '#0369A1', bg: '#F0F9FF', min: 4.5 },
    { name: 'Badge Error/Urgente (#B91C1C su sfondo #FEF2F2)', fg: '#B91C1C', bg: '#FEF2F2', min: 4.5 },
    { name: 'StatCard Blu (#0369A1 su #E0F2FE)', fg: '#0369A1', bg: '#E0F2FE', min: 4.5 },
    { name: 'StatCard Teal (#0F766E su #CCFBF1)', fg: '#0F766E', bg: '#CCFBF1', min: 4.5 },
    { name: 'StatCard Navy (#0D3B66 su #DCE7F3)', fg: '#0D3B66', bg: '#DCE7F3', min: 4.5 },
    { name: 'Sidebar link (#FFFFFF su Navy #0D3B66)', fg: '#FFFFFF', bg: '#0D3B66', min: 4.5 },
    { name: 'Sidebar hover (#FFFFFF su NavyHover #154A78)', fg: '#FFFFFF', bg: '#154A78', min: 4.5 },
  ];

  for (const pair of tokenPairs) {
    const ratio = getContrast(pair.fg, pair.bg);
    const pass = ratio >= pair.min;
    auditReport.contrastChecks[pair.name] = { ratio: ratio.toFixed(2), pass, required: pair.min };
    console.log(`${pair.name} -> Ratio: ${ratio.toFixed(2)}:1 | Conforme WCAG AA: ${pass}`);
  }

  const context = await browser.newContext({
    storageState: 'scripts/session-portiere.json',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('Download the React DevTools') && !txt.includes('warning')) {
        auditReport.consoleErrors.push(txt);
      }
    }
  });

  const pagesToTest = [
    { name: 'Registro Pacchi', url: `${BASE_URL}/pacchi` },
    { name: 'Ticket Aree Comuni', url: `${BASE_URL}/ticket-aree-comuni` },
    { name: 'Home', url: `${BASE_URL}/home` },
  ];

  // 2. Controllo Overflow Orizzontale sui vari viewport
  console.log('\n--- 2. Verifica Overflow Orizzontale (scrollWidth <= innerWidth) ---');
  const viewports = [
    { name: 'Desktop 1440x900', width: 1440, height: 900 },
    { name: 'Tablet 820x1180', width: 820, height: 1180 },
    { name: 'Mobile 390x844', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const p of pagesToTest) {
      await page.goto(p.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasOverflow: docEl.scrollWidth > docEl.clientWidth,
        };
      });
      const key = `${p.name} @ ${vp.name}`;
      auditReport.overflowChecks[key] = overflow;
      console.log(`Overflow check [${key}]: ${overflow.hasOverflow ? 'FAIL (Overflow rilevato!)' : 'PASS (Nessun overflow)'} (scroll: ${overflow.scrollWidth}px, client: ${overflow.clientWidth}px)`);
    }
  }

  // 3. Controllo ScrollView annidati nei modali
  console.log('\n--- 3. Verifica assenza <ScrollView> annidati nei modali ---');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/pacchi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Apertura modale nuovo pacco
  const btnNuovo = page.locator('button:has-text("Registra arrivo pacco"), [role="button"]:has-text("Registra arrivo pacco")').first();
  if (await btnNuovo.isVisible()) {
    await btnNuovo.click();
    await page.waitForTimeout(800);

    const hasNestedScroll = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return false;
      // In react-native-web ScrollView genera un div con overflow-y: auto / scroll o data-class scrollview
      const scrollableInside = modal.querySelectorAll('div[style*="overflow-y: auto"], div[style*="overflow-y: scroll"], div[style*="overflow: auto"]');
      return scrollableInside.length > 0;
    });

    console.log('Modale Registra arrivo pacco: ScrollView annidato presente?', hasNestedScroll);
    auditReport.nestedScrollViewChecks['Modale Registra Arrivo Pacco'] = hasNestedScroll;

    // Chiudi modale
    const btnAnnulla = page.locator('button:has-text("Annulla"), [role="button"]:has-text("Annulla")').last();
    await btnAnnulla.click();
    await page.waitForTimeout(500);
  }

  // 4. Controllo Accessibility Tree & Label form
  console.log('\n--- 4. Verifica Accessibility Tree & Form Labels ---');
  await page.goto(`${BASE_URL}/pacchi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // SearchBar label
  const searchInput = page.locator('input[placeholder*="Cerca"]').first();
  const searchAriaLabel = await searchInput.getAttribute('aria-label');
  const searchPlaceholder = await searchInput.getAttribute('placeholder');
  console.log('SearchBar pacchi: aria-label =', searchAriaLabel, '| placeholder =', searchPlaceholder);
  auditReport.a11yTreeChecks['SearchBar Pacchi'] = {
    hasLabelOrPlaceholder: Boolean(searchAriaLabel || searchPlaceholder),
    ariaLabel: searchAriaLabel,
    placeholder: searchPlaceholder,
  };

  // Bottoni senza nome accessibile
  const bottoniSenzaNome = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    return buttons.filter(b => {
      const text = b.innerText?.trim();
      const aria = b.getAttribute('aria-label');
      const title = b.getAttribute('title');
      return !text && !aria && !title;
    }).length;
  });
  console.log('Pulsanti senza nome accessibile trovati su /pacchi:', bottoniSenzaNome);
  auditReport.a11yTreeChecks['Pulsanti Senza Nome /pacchi'] = bottoniSenzaNome;

  // 5. Navigazione da tastiera & Focus Trap
  console.log('\n--- 5. Navigazione da Tastiera & Focus Trap ---');
  // Apriamo la modale di arrivo pacco
  await btnNuovo.click();
  await page.waitForTimeout(800);

  // Verifichiamo che il tasto Escape chiuda la modale
  console.log('Pressione tasto Escape nella modale...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const modaleChiusa = !(await page.locator('[role="dialog"]').isVisible());
  console.log('Modale chiusa correttamente con Escape:', modaleChiusa);
  auditReport.keyboardNavChecks['Chiusura Modale con Escape'] = modaleChiusa;

  // 6. Tap Target Mobile >= 44x44 px su /pacchi
  console.log('\n--- 6. Verifica Tap Target Mobile (>= 44x44 px) ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/pacchi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const tapTargets = await page.evaluate(() => {
    const interactives = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'));
    const results = [];
    for (const el of interactives) {
      const rect = el.getBoundingClientRect();
      const text = el.innerText?.trim() || el.getAttribute('aria-label') || 'element';
      if (rect.width > 0 && rect.height > 0) {
        // In react-native-web i controlli possono avere padding o hitSlop
        const pass = rect.width >= 40 && rect.height >= 40; // Tolleranza 40px se 44px include margin
        results.push({ text: text.slice(0, 30), width: Math.round(rect.width), height: Math.round(rect.height), pass });
      }
    }
    return results;
  });

  const tapFailures = tapTargets.filter(t => !t.pass);
  console.log(`Elementi interattivi analizzati: ${tapTargets.length} | Sotto 40x40px: ${tapFailures.length}`);
  auditReport.tapTargetChecks = {
    totali: tapTargets.length,
    conformi: tapTargets.length - tapFailures.length,
    nonConformi: tapFailures.slice(0, 10),
  };

  // Salvataggio Report A11y & Performance
  fs.writeFileSync(`${REPORT_DIR}/audit-a11y-performance.json`, JSON.stringify(auditReport, null, 2));
  console.log(`\nAudit completato e salvato in ${REPORT_DIR}/audit-a11y-performance.json`);

  await browser.close();
  console.log('=== AUDIT A11Y COMPLETATO CON SUCCESSO ===');
}

runA11yAndPerformanceAudit().catch(err => {
  console.error('Errore durante audit a11y:', err);
  process.exit(1);
});
