import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST_DIR = path.resolve('apps/app/dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqPath = (req.url || '/').split('?')[0];
      let filePath = path.join(rootDir, reqPath === '/' ? 'index.html' : reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const htmlCandidate = `${filePath}.html`;
        if (fs.existsSync(htmlCandidate)) {
          filePath = htmlCandidate;
        } else {
          filePath = path.join(rootDir, 'index.html');
        }
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function creaStatoMock(ruoloAttivo, abilitaPrenotazioni = true) {
  const userId = ruoloAttivo === 'ADMIN' ? 'u-admin-1' : 'u-cond-1';
  const condId = 'd0000000-0000-4000-8000-000000000001';

  const adesso = new Date();
  const baseGiorno = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() + 1);
  const domaniLabel = `${String(baseGiorno.getDate()).padStart(2, '0')}/${String(
    baseGiorno.getMonth() + 1,
  ).padStart(2, '0')}/${baseGiorno.getFullYear()}`;

  const slotOccupatoStart = new Date(
    baseGiorno.getFullYear(),
    baseGiorno.getMonth(),
    baseGiorno.getDate(),
    14,
    0,
    0,
    0,
  );
  const slotOccupatoEnd = new Date(
    baseGiorno.getFullYear(),
    baseGiorno.getMonth(),
    baseGiorno.getDate(),
    16,
    0,
    0,
    0,
  );

  const mioSlotStart = new Date(
    baseGiorno.getFullYear(),
    baseGiorno.getMonth(),
    baseGiorno.getDate() + 2,
    10,
    0,
    0,
    0,
  );
  const mioSlotEnd = new Date(
    baseGiorno.getFullYear(),
    baseGiorno.getMonth(),
    baseGiorno.getDate() + 2,
    11,
    0,
    0,
    0,
  );

  const risorse = [
    {
      id: 'ris-1',
      condominio_id: condId,
      nome: 'Campo da tennis',
      tariffa_oraria: 12.5,
      max_ore: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'ris-2',
      condominio_id: condId,
      nome: 'Parcheggio ospiti',
      tariffa_oraria: 0,
      max_ore: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  const prenotazioni = [
    {
      id: 'pren-vicino',
      risorsa_id: 'ris-1',
      utente_id: 'u-altro',
      data_inizio: slotOccupatoStart.toISOString(),
      data_fine: slotOccupatoEnd.toISOString(),
      costo_addebitato: 25,
      created_at: '2026-11-01T00:00:00Z',
      utente_nome: 'Giulia Bianchi',
      utente_email: 'giulia@example.test',
    },
    {
      id: 'pren-mia',
      risorsa_id: 'ris-2',
      utente_id: 'u-cond-1',
      data_inizio: mioSlotStart.toISOString(),
      data_fine: mioSlotEnd.toISOString(),
      costo_addebitato: 0,
      created_at: '2026-11-01T00:00:00Z',
      utente_nome: 'Luigi Verdi Condomino',
      utente_email: 'condomino@example.test',
    },
  ];

  let seq = 100;

  return {
    userId,
    condId,
    ruoloAttivo,
    abilitaPrenotazioni,
    domaniLabel,
    risorse,
    prenotazioni,
    nextId: (prefix) => `${prefix}-${seq++}`,
  };
}

async function setupSupabaseMocks(page, stato) {
  const fakeSession = {
    access_token: 'fake-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: stato.userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: stato.ruoloAttivo === 'ADMIN' ? 'admin@example.test' : 'condomino@example.test',
    },
  };

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeSession),
      });
    }
    if (url.includes('/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeSession.user),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop();
    const method = req.method();
    const accept = req.headers()['accept'] || '';
    const isSingle = accept.includes('application/vnd.pgrst.object+json');

    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });

    if (table === 'utenti') {
      const utente = {
        id: stato.userId,
        nome_cognome: stato.ruoloAttivo === 'ADMIN' ? 'Mario Rossi Admin' : 'Luigi Verdi Condomino',
        email: fakeSession.user.email,
        telefono: '+39 02 1234567',
        is_superadmin: false,
        avatar_url: null,
      };
      return json(isSingle ? utente : [utente]);
    }

    if (table === 'ruoli_piattaforma') {
      return json([
        { id: 'r-admin', codice: 'ADMIN', descrizione: 'Amministratore' },
        { id: 'r-cond', codice: 'CONDOMINO', descrizione: 'Condòmino' },
        { id: 'r-port', codice: 'PORTIERE', descrizione: 'Portiere' },
      ]);
    }

    if (table === 'utente_entita_ruolo') {
      return json([
        {
          id: 'uer-1',
          utente_id: stato.userId,
          ruolo_id: stato.ruoloAttivo === 'ADMIN' ? 'r-admin' : 'r-cond',
          condominio_id: stato.condId,
          unita_id: stato.ruoloAttivo === 'ADMIN' ? null : 'unita-1',
        },
      ]);
    }

    if (table === 'condomini') {
      if (url.searchParams.get('admin_id') && stato.ruoloAttivo !== 'ADMIN') {
        return json([]);
      }
      const cond = {
        id: stato.condId,
        nome: 'Condominio di Prova',
        indirizzo: 'Via dei Test 1',
        citta: 'Milano',
        codice_fiscale: '90000000001',
      };
      return json(isSingle ? cond : [cond]);
    }

    if (table === 'configurazioni_condominio') {
      const cfg = {
        condominio_id: stato.condId,
        palazzo_id: null,
        abilita_social: true,
        abilita_chat: true,
        abilita_bacheca: true,
        abilita_ticket: true,
        abilita_prenotazioni: stato.abilitaPrenotazioni,
        abilita_pacchi: true,
      };
      return json(isSingle ? cfg : [cfg]);
    }

    if (table === 'risorse_prenotabili') {
      if (method === 'GET') {
        const idEq = url.searchParams.get('id')?.replace('eq.', '');
        if (idEq) {
          const found = stato.risorse.find((r) => r.id === idEq);
          return found ? json(isSingle ? found : [found]) : json({ message: 'Not found' }, 404);
        }
        return json(stato.risorse);
      }
      if (method === 'POST') {
        const body = JSON.parse(req.postData() || '{}');
        const nuova = {
          id: stato.nextId('ris'),
          condominio_id: body.condominio_id || stato.condId,
          nome: body.nome,
          tariffa_oraria: Number(body.tariffa_oraria) || 0,
          max_ore: body.max_ore ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        stato.risorse.push(nuova);
        return json(isSingle ? nuova : [nuova], 201);
      }
      if (method === 'PATCH') {
        const idEq = url.searchParams.get('id')?.replace('eq.', '');
        const body = JSON.parse(req.postData() || '{}');
        const idx = stato.risorse.findIndex((r) => r.id === idEq);
        if (idx >= 0) {
          stato.risorse[idx] = { ...stato.risorse[idx], ...body, updated_at: new Date().toISOString() };
          return json(isSingle ? stato.risorse[idx] : [stato.risorse[idx]]);
        }
        return json({ message: 'Not found' }, 404);
      }
      if (method === 'DELETE') {
        const idEq = url.searchParams.get('id')?.replace('eq.', '');
        stato.risorse = stato.risorse.filter((r) => r.id !== idEq);
        stato.prenotazioni = stato.prenotazioni.filter((p) => p.risorsa_id !== idEq);
        return route.fulfill({ status: 204 });
      }
    }

    if (table === 'prenotazioni_spazi') {
      if (method === 'GET') {
        const joined = stato.prenotazioni.map((p) => {
          const ris = stato.risorse.find((r) => r.id === p.risorsa_id);
          return {
            ...p,
            risorse_prenotabili: ris
              ? { nome: ris.nome, condominio_id: ris.condominio_id, tariffa_oraria: ris.tariffa_oraria }
              : { nome: 'Spazio', condominio_id: stato.condId, tariffa_oraria: 0 },
            utenti: { nome_cognome: p.utente_nome, email: p.utente_email },
          };
        });
        return json(joined);
      }
      if (method === 'POST') {
        const body = JSON.parse(req.postData() || '{}');
        const sA = new Date(body.data_inizio).getTime();
        const eA = new Date(body.data_fine).getTime();
        const overlap = stato.prenotazioni.some((p) => {
          if (p.risorsa_id !== body.risorsa_id) return false;
          const sB = new Date(p.data_inizio).getTime();
          const eB = new Date(p.data_fine).getTime();
          return sA < eB && eA > sB;
        });
        if (overlap) {
          return json({ code: '23P01', message: 'exclusion constraint violated' }, 409);
        }
        const nuova = {
          id: stato.nextId('pren'),
          risorsa_id: body.risorsa_id,
          utente_id: body.utente_id,
          data_inizio: body.data_inizio,
          data_fine: body.data_fine,
          costo_addebitato: Number(body.costo_addebitato) || 0,
          created_at: new Date().toISOString(),
          utente_nome: stato.ruoloAttivo === 'ADMIN' ? 'Mario Rossi Admin' : 'Luigi Verdi Condomino',
          utente_email: fakeSession.user.email,
        };
        stato.prenotazioni.push(nuova);
        return json(isSingle ? nuova : [nuova], 201);
      }
      if (method === 'DELETE') {
        const idEq = url.searchParams.get('id')?.replace('eq.', '');
        stato.prenotazioni = stato.prenotazioni.filter((p) => p.id !== idEq);
        return route.fulfill({ status: 204 });
      }
    }

    if (table === 'notifiche') {
      return json([]);
    }

    return json(isSingle ? null : []);
  });
}

async function loginMock(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[autocomplete="email"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[autocomplete="email"]').first().fill('test@example.test');
  await page.locator('input[type="password"]').first().fill('Password123!');
  await page.getByRole('button', { name: /accedi/i }).first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
}

async function verificaViewportEZoom(page, label) {
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert.ok(
      overflow.scrollWidth <= overflow.innerWidth,
      `Overflow orizzontale su ${label} (${vp.width}x${vp.height}): scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.innerWidth}`,
    );

    if (vp.width === 390) {
      // Verifica tap target >= 44px sui pulsanti visibili su mobile
      const smallButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        return btns
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.height < 40;
          })
          .map((el) => ({ text: el.textContent?.trim(), h: el.getBoundingClientRect().height }));
      });
      assert.equal(
        smallButtons.length,
        0,
        `Trovati pulsanti con altezza < 40px su mobile (${label}): ${JSON.stringify(smallButtons)}`,
      );
    }
  }

  // Zoom 200% equivalente su monitor 1440x900 (viewport logico 720x450)
  await page.setViewportSize({ width: 720, height: 450 });
  await page.waitForTimeout(250);
  const zoomOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    zoomOverflow.scrollWidth <= zoomOverflow.innerWidth,
    `Overflow orizzontale a Zoom 200% (720x450) su ${label}: scrollWidth=${zoomOverflow.scrollWidth}, innerWidth=${zoomOverflow.innerWidth}`,
  );

  // Controllo a11y globale: nessun input orfano senza aria-label/label
  const orphanedInputs = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    return inputs
      .filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        const hasLabel = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !hasAria && !hasLabel;
      })
      .map((el) => el.outerHTML.slice(0, 120));
  });
  assert.equal(
    orphanedInputs.length,
    0,
    `Input senza label accessibile su ${label}: ${JSON.stringify(orphanedInputs)}`,
  );
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Directory export Expo non trovata: ${DIST_DIR}`);
  }

  const { server, url: baseUrl } = await startStaticServer(DIST_DIR);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    // =========================================================================
    // 1. FLUSSO CONDÒMINO
    // =========================================================================
    console.log('--- 1. Verifica flusso Condòmino (/prenotazioni) ---');
    const statoCond = creaStatoMock('CONDOMINO', true);
    const ctxCond = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageCond = await ctxCond.newPage();
    const erroriCond = [];
    pageCond.on('pageerror', (e) => erroriCond.push(e.message));
    pageCond.on('console', (m) => {
      if (m.type() === 'error') erroriCond.push(m.text());
    });

    await setupSupabaseMocks(pageCond, statoCond);
    await loginMock(pageCond, baseUrl);

    await pageCond.getByText('Spazi comuni').first().click();
    await pageCond.waitForURL('**/prenotazioni', { timeout: 10000 });
    await pageCond.getByText('Prenotazione spazi comuni').waitFor({ timeout: 10000 });
    await pageCond.getByText('Campo da tennis').first().waitFor({ timeout: 10000 });

    // Privacy: la prenotazione del vicino non deve comparire in "Le mie prenotazioni"
    assert.equal(await pageCond.getByText('Giulia Bianchi').count(), 0);

    // Apre modale "Prenota spazio comune" cliccando su "Nuova prenotazione"
    await pageCond.getByRole('button', { name: /nuova prenotazione/i }).click();
    await pageCond.getByText('Prenota spazio comune').waitFor({ timeout: 5000 });

    // Seleziona domani per avere tutte le fasce orarie nel futuro indipendentemente dall'ora corrente
    await pageCond.getByRole('textbox', { name: 'Data prenotazione' }).fill(statoCond.domaniLabel);

    // Verifica privacy negli slot: mostra "Occupato"
    await pageCond.getByText('Occupato').first().waitFor({ timeout: 5000 });

    // Verifica blocco su max_ore (Campo da tennis max 2 ore -> 09:00 - 13:00)
    await pageCond.getByRole('combobox', { name: /ora inizio/i }).click();
    await pageCond.getByRole('option', { name: '09:00' }).click();
    await pageCond.getByRole('combobox', { name: /ora fine/i }).click();
    await pageCond.getByRole('option', { name: '13:00' }).click();
    await pageCond.getByRole('button', { name: /conferma prenotazione/i }).click();
    await pageCond.getByText(/durata massima consentita/i).waitFor({ timeout: 5000 });

    // Verifica blocco su fascia oraria sovrapposta (14:00 - 15:00 occupata da vicino)
    await pageCond.getByRole('combobox', { name: /ora inizio/i }).click();
    await pageCond.getByRole('option', { name: '14:00' }).click();
    await pageCond.getByRole('combobox', { name: /ora fine/i }).click();
    await pageCond.getByRole('option', { name: '15:00' }).click();
    await pageCond.getByRole('button', { name: /conferma prenotazione/i }).click();
    await pageCond.getByText(/già prenotato nella fascia oraria scelta/i).waitFor({ timeout: 5000 });

    // Crea prenotazione valida (10:00 - 12:00 su Campo da tennis => 25,00 €)
    await pageCond.getByRole('combobox', { name: /ora inizio/i }).click();
    await pageCond.getByRole('option', { name: '10:00' }).click();
    await pageCond.getByRole('combobox', { name: /ora fine/i }).click();
    await pageCond.getByRole('option', { name: '12:00' }).click();
    await pageCond.getByText(/25,00 €/).first().waitFor({ timeout: 5000 });
    await pageCond.getByRole('button', { name: /conferma prenotazione/i }).click();
    await pageCond.getByText(/prenotazione confermata/i).waitFor({ timeout: 5000 });

    // Annulla la prenotazione tramite ConfirmDialog
    await pageCond.getByRole('button', { name: 'Annulla' }).first().click();
    await pageCond.getByText('Annullare la prenotazione?').waitFor({ timeout: 5000 });
    await pageCond.getByRole('button', { name: 'Annulla prenotazione' }).click();
    await pageCond.getByText('Annullare la prenotazione?').waitFor({ state: 'hidden', timeout: 5000 });
    await pageCond.getByText(/prenotazione annullata/i).waitFor({ timeout: 12000 });

    // Verifica viewport e zoom 200%
    await verificaViewportEZoom(pageCond, 'Condomino /prenotazioni');

    // Verifica blocco /admin/prenotazioni per CONDOMINO
    await pageCond.goto(`${baseUrl}/admin/prenotazioni`, { waitUntil: 'networkidle' });
    await pageCond.getByText(/non hai|non autorizzato|non è disponibile/i).first().waitFor({ timeout: 10000 });

    assert.equal(erroriCond.length, 0, `Errori JS Condòmino: ${erroriCond.join(' | ')}`);
    await ctxCond.close();
    console.log('✓ Flusso Condòmino superato');

    // =========================================================================
    // 2. VERIFICA TOGGLE abilita_prenotazioni = false
    // =========================================================================
    console.log('--- 2. Verifica modulo disattivato (abilita_prenotazioni = false) ---');
    const statoOff = creaStatoMock('CONDOMINO', false);
    const ctxOff = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageOff = await ctxOff.newPage();
    await setupSupabaseMocks(pageOff, statoOff);
    await loginMock(pageOff, baseUrl);
    await pageOff.getByText('Home').first().waitFor({ timeout: 10000 });
    assert.equal(await pageOff.getByText('Spazi comuni').count(), 0, 'La voce Spazi comuni deve sparire se abilita_prenotazioni=false');
    await ctxOff.close();
    console.log('✓ Modulo disattivato nascosto correttamente');

    // =========================================================================
    // 3. FLUSSO AMMINISTRATORE
    // =========================================================================
    console.log('--- 3. Verifica flusso Amministratore (/admin/prenotazioni) ---');
    const statoAdmin = creaStatoMock('ADMIN', true);
    const ctxAdmin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageAdmin = await ctxAdmin.newPage();
    const erroriAdmin = [];
    pageAdmin.on('pageerror', (e) => erroriAdmin.push(e.message));
    pageAdmin.on('console', (m) => {
      if (m.type() === 'error') erroriAdmin.push(m.text());
    });

    await setupSupabaseMocks(pageAdmin, statoAdmin);
    await loginMock(pageAdmin, baseUrl);

    await pageAdmin.getByText('Spazi comuni').first().click();
    await pageAdmin.waitForURL('**/admin/prenotazioni', { timeout: 10000 });
    await pageAdmin.getByText('Spazi comuni e Prenotazioni').waitFor({ timeout: 10000 });
    await pageAdmin.getByText('Spazi configurati').first().waitFor({ timeout: 10000 });

    // Crea nuovo spazio (Lavanderia, 3,50 €, max 2 ore)
    await pageAdmin.getByRole('button', { name: /nuovo spazio/i }).click();
    await pageAdmin.getByText('Nuovo spazio comune').waitFor({ timeout: 5000 });
    await pageAdmin.getByLabel(/nome spazio/i).fill('Lavanderia');
    await pageAdmin.getByLabel(/tariffa oraria/i).fill('3,50');
    await pageAdmin.getByLabel(/durata massima/i).fill('2');
    await pageAdmin.getByRole('button', { name: /crea spazio/i }).click();
    await pageAdmin.getByText(/spazio creato/i).waitFor({ timeout: 5000 });
    await pageAdmin.getByText('Lavanderia').first().waitFor({ timeout: 5000 });

    // Modifica spazio Lavanderia
    const rigaLavanderia = pageAdmin.locator('[role="row"]', { hasText: 'Lavanderia' }).first();
    await rigaLavanderia.getByRole('button', { name: /modifica/i }).click();
    await pageAdmin.getByText('Modifica spazio comune').waitFor({ timeout: 5000 });
    await pageAdmin.getByLabel(/tariffa oraria/i).fill('4,00');
    await pageAdmin.getByRole('button', { name: /salva modifiche/i }).click();
    await pageAdmin.getByText(/spazio aggiornato/i).waitFor({ timeout: 12000 });

    // Elimina spazio Lavanderia con ConfirmDialog
    await rigaLavanderia.getByRole('button', { name: /elimina/i }).click();
    await pageAdmin.getByText('Eliminare lo spazio comune?').waitFor({ timeout: 5000 });
    await pageAdmin.getByRole('button', { name: 'Elimina spazio' }).click();
    await pageAdmin.getByText(/spazio eliminato/i).waitFor({ timeout: 12000 });

    // Tab Calendario prenotazioni -> annulla prenotazione
    await pageAdmin.getByRole('tab', { name: /calendario prenotazioni/i }).click();
    await pageAdmin.getByText('Giulia Bianchi').first().waitFor({ timeout: 5000 });
    await pageAdmin.getByRole('button', { name: 'Annulla' }).first().click();
    await pageAdmin.getByText('Annullare la prenotazione?').waitFor({ timeout: 5000 });
    await pageAdmin.getByRole('button', { name: 'Annulla prenotazione' }).click();
    await pageAdmin.getByText(/prenotazione annullata/i).waitFor({ timeout: 12000 });

    // Verifica viewport e zoom 200%
    await verificaViewportEZoom(pageAdmin, 'Admin /admin/prenotazioni');

    assert.equal(erroriAdmin.length, 0, `Errori JS Admin: ${erroriAdmin.join(' | ')}`);
    await ctxAdmin.close();
    console.log('✓ Flusso Amministratore superato');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('ERRORE TEST PLAYWRIGHT:', err);
  process.exit(1);
});
