import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST_DIR = path.resolve('apps/app/dist-raccolta-check');

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

function creaStatoMock(ruoloAttivo) {
  const userId = ruoloAttivo === 'ADMIN' ? 'u-admin-1' : 'u-cond-1';
  const condId = 'd0000000-0000-4000-8000-000000000001';

  const adesso = new Date();
  const jsDay = adesso.getDay();
  const oggi = jsDay === 0 ? 7 : jsDay;
  const domani = (oggi % 7) + 1;

  const turni = [
    {
      id: 't-1',
      condominio_id: condId,
      tipo_rifiuto: 'Umido / Organico',
      giorno_settimana: oggi,
      note: 'Esporre entro le 7:00 nel mastello marrone.',
    },
    {
      id: 't-2',
      condominio_id: condId,
      tipo_rifiuto: 'Carta e cartone',
      giorno_settimana: domani,
      note: 'Piegare gli scatoloni.',
    },
    {
      id: 't-3',
      condominio_id: condId,
      tipo_rifiuto: 'Vetro',
      giorno_settimana: ((domani % 7) + 1),
      note: 'Solo campana verde senza sacchetti.',
    },
  ];
  let seq = 10;

  return {
    userId,
    condId,
    ruoloAttivo,
    turni,
    nextId: () => `t-${seq++}`,
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
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
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
      const ruoli = [
        { id: 'r-admin', codice: 'ADMIN', descrizione: 'Amministratore' },
        { id: 'r-cond', codice: 'CONDOMINO', descrizione: 'Condòmino' },
        { id: 'r-port', codice: 'PORTIERE', descrizione: 'Portiere' },
      ];
      return json(ruoli);
    }

    if (table === 'utente_entita_ruolo') {
      const righe = [
        {
          id: 'uer-1',
          utente_id: stato.userId,
          ruolo_id: stato.ruoloAttivo === 'ADMIN' ? 'r-admin' : 'r-cond',
          condominio_id: stato.condId,
          unita_id: stato.ruoloAttivo === 'ADMIN' ? null : 'unita-1',
        },
      ];
      return json(righe);
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
        abilita_chat: true,
        abilita_bacheca: true,
        abilita_ticket: true,
        abilita_pacchi: true,
      };
      return json(isSingle ? cfg : [cfg]);
    }

    if (table === 'raccolta_differenziata') {
      if (method === 'GET') {
        return json(stato.turni);
      }
      if (method === 'POST') {
        const body = JSON.parse(req.postData() || '{}');
        const nuovo = {
          id: stato.nextId(),
          condominio_id: body.condominio_id || stato.condId,
          tipo_rifiuto: body.tipo_rifiuto,
          giorno_settimana: body.giorno_settimana,
          note: body.note ?? null,
        };
        stato.turni.push(nuovo);
        return json(isSingle ? nuovo : [nuovo], 201);
      }
      if (method === 'PATCH') {
        const idFilter = url.searchParams.get('id')?.replace('eq.', '');
        const body = JSON.parse(req.postData() || '{}');
        const idx = stato.turni.findIndex((t) => t.id === idFilter);
        if (idx >= 0) {
          stato.turni[idx] = { ...stato.turni[idx], ...body };
          return json(isSingle ? stato.turni[idx] : [stato.turni[idx]]);
        }
        return json({ message: 'Not found' }, 404);
      }
      if (method === 'DELETE') {
        const idFilter = url.searchParams.get('id')?.replace('eq.', '');
        const idx = stato.turni.findIndex((t) => t.id === idFilter);
        if (idx >= 0) stato.turni.splice(idx, 1);
        return json(null, 204);
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

async function verificaViewport(page, width, height, label) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    overflow.scrollWidth <= overflow.innerWidth,
    `Overflow orizzontale rilevato su ${label} (${width}x${height}): scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth}`,
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
    // 1. FLUSSO CONDÒMINO (sola lettura + blocco admin)
    // =========================================================================
    console.log('--- 1. Verifica flusso Condòmino ---');
    const statoCond = creaStatoMock('CONDOMINO');
    const ctxCond = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageCond = await ctxCond.newPage();
    const erroriCond = [];
    pageCond.on('pageerror', (e) => erroriCond.push(e.message));
    pageCond.on('console', (msg) => {
      if (msg.type() === 'error') erroriCond.push(msg.text());
    });

    await setupSupabaseMocks(pageCond, statoCond);
    await loginMock(pageCond, baseUrl);

    await pageCond.goto(`${baseUrl}/raccolta-differenziata`, { waitUntil: 'networkidle' });
    await pageCond.waitForSelector('text=Raccolta differenziata', { timeout: 15000 });
    try {
      await pageCond.waitForSelector('text=Umido / Organico', { timeout: 10000 });
    } catch (e) {
      console.log('BODY AL TIMEOUT:', await pageCond.innerText('body'));
      console.log('ERRORI CONSOLE:', erroriCond);
      throw e;
    }

    const bodyCond = await pageCond.innerText('body');
    assert.ok(bodyCond.includes('Oggi —'), 'Manca riquadro Oggi');
    assert.ok(bodyCond.includes('Domani —'), 'Manca riquadro Domani');
    assert.ok(bodyCond.includes('Esporre entro le 7:00'), 'Mancano le note del turno');
    assert.ok(!bodyCond.includes('Nuovo turno'), 'Non deve esserci Nuovo turno per Condòmino');
    assert.ok(!bodyCond.includes('Elimina'), 'Non deve esserci Elimina per Condòmino');

    // Ricerca testuale
    const searchInput = pageCond.getByPlaceholder(/cerca per tipologia/i);
    await searchInput.fill('campana');
    await pageCond.waitForTimeout(200);
    const bodyRicerca = await pageCond.innerText('body');
    assert.ok(bodyRicerca.includes('Vetro'), 'La ricerca su note deve trovare Vetro');
    await searchInput.fill('');

    // 3 viewport + zoom 200%
    await verificaViewport(pageCond, 1440, 900, 'condomino');
    await verificaViewport(pageCond, 820, 1180, 'condomino');
    await verificaViewport(pageCond, 390, 844, 'condomino');

    // Zoom 200% equivalente su monitor 1440x900 (viewport logico 720x450)
    await verificaViewport(pageCond, 720, 450, 'condomino-zoom-200');

    // Blocco rotta admin per Condòmino
    await pageCond.goto(`${baseUrl}/admin/raccolta-differenziata`, { waitUntil: 'networkidle' });
    await pageCond.waitForTimeout(400);
    const bodyBlocco = await pageCond.innerText('body');
    assert.ok(
      bodyBlocco.includes('Non hai') || bodyBlocco.includes('Non autorizzato') || bodyBlocco.includes('non è disponibile'),
      'La rotta admin deve essere bloccata per il Condòmino',
    );
    assert.equal(erroriCond.length, 0, `Errori console Condòmino: ${erroriCond.join(' | ')}`);
    await ctxCond.close();
    console.log('Flusso Condòmino OK.');

    // =========================================================================
    // 2. FLUSSO AMMINISTRATORE (CRUD + tastiera + tap target + 3 viewport)
    // =========================================================================
    console.log('--- 2. Verifica flusso Amministratore ---');
    const statoAdmin = creaStatoMock('ADMIN');
    const ctxAdmin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageAdmin = await ctxAdmin.newPage();
    const erroriAdmin = [];
    pageAdmin.on('pageerror', (e) => erroriAdmin.push(e.message));
    pageAdmin.on('console', (msg) => {
      if (msg.type() === 'error') erroriAdmin.push(msg.text());
    });

    await setupSupabaseMocks(pageAdmin, statoAdmin);
    await loginMock(pageAdmin, baseUrl);

    await pageAdmin.goto(`${baseUrl}/admin/raccolta-differenziata`, { waitUntil: 'networkidle' });
    await pageAdmin.waitForSelector('text=Turni configurati', { timeout: 15000 });

    // Apertura modale Nuovo turno + test Tab/Shift+Tab e chiusura con Annulla
    await pageAdmin.getByRole('button', { name: /nuovo turno/i }).click();
    await pageAdmin.waitForSelector('text=Nuovo turno di raccolta', { timeout: 5000 });
    await pageAdmin.waitForTimeout(150);
    await pageAdmin.keyboard.press('Tab');
    await pageAdmin.keyboard.press('Shift+Tab');
    await pageAdmin.getByRole('button', { name: /annulla/i }).click();
    await pageAdmin.locator('text=Nuovo turno di raccolta').waitFor({ state: 'hidden', timeout: 5000 });

    // Riapertura + validazione form vuoto
    await pageAdmin.getByRole('button', { name: /nuovo turno/i }).click();
    await pageAdmin.waitForSelector('text=Nuovo turno di raccolta', { timeout: 5000 });
    await pageAdmin.getByRole('button', { name: /salva turno/i }).click();
    await pageAdmin.waitForSelector('text=Inserisci la tipologia di rifiuto.', { timeout: 5000 });

    // Compilazione e salvataggio nuovo turno
    await pageAdmin.getByLabel(/tipo di rifiuto/i).fill('Ingombranti');
    await pageAdmin.getByLabel(/note e orari di esposizione/i).fill('Prenotare ritiro in portineria');
    await pageAdmin.getByRole('button', { name: /salva turno/i }).click();
    await pageAdmin.waitForSelector('text=Ingombranti', { timeout: 5000 });

    // Modifica turno
    const btnModifica = pageAdmin.getByRole('button', { name: /modifica/i }).first();
    await btnModifica.click();
    await pageAdmin.waitForSelector('text=Modifica turno di raccolta', { timeout: 5000 });
    await pageAdmin.getByLabel(/note e orari di esposizione/i).fill('Nota aggiornata dal test');
    await pageAdmin.getByRole('button', { name: /salva modifiche/i }).click();
    await pageAdmin.waitForSelector('text=Nota aggiornata dal test', { timeout: 5000 });

    // Eliminazione con ConfirmDialog
    const btnElimina = pageAdmin.getByRole('button', { name: /elimina/i }).first();
    await btnElimina.click();
    await pageAdmin.waitForSelector('text=Eliminare il turno di raccolta?', { timeout: 5000 });
    await pageAdmin.getByRole('button', { name: /elimina turno/i }).click();
    await pageAdmin.waitForTimeout(300);

    // Verifica 3 viewport + tap target >= 44px su mobile
    await verificaViewport(pageAdmin, 1440, 900, 'admin');
    await verificaViewport(pageAdmin, 820, 1180, 'admin');
    await verificaViewport(pageAdmin, 390, 844, 'admin');

    const tapCheck = await pageAdmin.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="button"]')).find((el) =>
        (el.textContent || '').includes('Nuovo turno'),
      );
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    assert.ok(tapCheck && tapCheck.height >= 44, `Tap target Nuovo turno < 44px: ${JSON.stringify(tapCheck)}`);

    assert.equal(erroriAdmin.length, 0, `Errori console Admin: ${erroriAdmin.join(' | ')}`);
    await ctxAdmin.close();
    console.log('Flusso Amministratore OK.');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('TEST FALLITO:', err);
  process.exit(1);
});
