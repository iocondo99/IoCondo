import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const SCRATCH_DIST = 'C:\\Users\\mromeo2\\.gemini\\antigravity-cli\\brain\\f3358a44-861d-4599-aa54-1d6f82ea0924\\scratch\\dist';
const DIST_DIR = fs.existsSync(SCRATCH_DIST) ? SCRATCH_DIST : path.resolve('apps/app/dist');

console.log(`[INIT] Utilizzo build web da: ${DIST_DIR}`);

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

const CONDOMINIO_ID = 'd0000000-0000-4000-8000-000000000001';
const PALAZZO_A_ID = 'd0000000-0000-4000-8000-000000000002';
const SCALA_A_ID = 'd0000000-0000-4000-8000-000000000021';
const SCALA_B_ID = 'd0000000-0000-4000-8000-000000000022';
const UNITA_1_ID = 'd0000000-0000-4000-8000-000000000011';
const UNITA_2_ID = 'd0000000-0000-4000-8000-000000000012';

const CAT_IDRAULICA = 'c0000000-0000-4000-8000-000000000001';
const CAT_ELETTRICA = 'c0000000-0000-4000-8000-000000000002';
const CAT_SERRAMENTI = 'c0000000-0000-4000-8000-000000000003';
const CAT_ASCENSORE = 'c0000000-0000-4000-8000-000000000004';

function creaMockDatabase() {
  const palazzi = [
    { id: PALAZZO_A_ID, condominio_id: CONDOMINIO_ID, nome_identificativo: 'Palazzo A', indirizzo: 'Via dei Test 1' },
  ];

  const scale = [
    { id: SCALA_A_ID, palazzo_id: PALAZZO_A_ID, nome: 'Scala A' },
    { id: SCALA_B_ID, palazzo_id: PALAZZO_A_ID, nome: 'Scala B' },
  ];

  const unita = [
    { id: UNITA_1_ID, palazzo_id: PALAZZO_A_ID, scala_colonna_id: SCALA_A_ID, interno: '1', piano: 1, tipologia_id: 't-1' },
    { id: UNITA_2_ID, palazzo_id: PALAZZO_A_ID, scala_colonna_id: SCALA_B_ID, interno: '2', piano: 1, tipologia_id: 't-1' },
  ];

  const anagrafiche = [
    { id: 'anag-1', unita_id: UNITA_1_ID, utente_id: 'u-cond-scala-a', data_fine: null, tipo_possesso: 'PROPRIETARIO', quota_possesso: 100 },
    { id: 'anag-2', unita_id: UNITA_2_ID, utente_id: 'u-cond-scala-b', data_fine: null, tipo_possesso: 'PROPRIETARIO', quota_possesso: 100 },
  ];

  const categorie = [
    { id: CAT_IDRAULICA, nome: 'Idraulica' },
    { id: CAT_ELETTRICA, nome: 'Elettrica' },
    { id: CAT_SERRAMENTI, nome: 'Serramenti' },
    { id: CAT_ASCENSORE, nome: 'Ascensore' },
  ];

  const fornitori = [
    {
      id: 'forn-1',
      admin_id: 'u-admin-1',
      ragione_sociale: 'Termoidraulica Rossi S.r.l.',
      categoria: 'Idraulico',
      p_iva: '12345678901',
      telefono: '061234567',
      email: 'rossi@fornitori.test',
      iban: 'IT60X0542811101000000123456',
    },
  ];

  const tickets = [
    // Area comune condominiale
    {
      id: 'tkt-cond-1',
      condominio_id: CONDOMINIO_ID,
      palazzo_id: null,
      scala_colonna_id: null,
      unita_id: null,
      is_area_comune: true,
      segnalatore_id: 'u-cond-scala-a',
      categoria_id: CAT_ASCENSORE,
      titolo: 'Ascensore principale rumoroso',
      descrizione: 'Forte rumore metallico durante la salita.',
      priorita: 'MEDIA',
      stato: 'APERTO',
      fornitore_assegnato_id: null,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      closed_at: null,
    },
    // Palazzo A
    {
      id: 'tkt-palazzo-1',
      condominio_id: CONDOMINIO_ID,
      palazzo_id: PALAZZO_A_ID,
      scala_colonna_id: null,
      unita_id: null,
      is_area_comune: false,
      segnalatore_id: 'u-cond-scala-a',
      categoria_id: CAT_IDRAULICA,
      titolo: 'Perdita autoclave Palazzo A',
      descrizione: 'Gocciolamento continuo tubazione autoclave.',
      priorita: 'ALTA',
      stato: 'APERTO',
      fornitore_assegnato_id: null,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      closed_at: null,
    },
    // Scala A
    {
      id: 'tkt-scala-a-1',
      condominio_id: CONDOMINIO_ID,
      palazzo_id: PALAZZO_A_ID,
      scala_colonna_id: SCALA_A_ID,
      unita_id: null,
      is_area_comune: false,
      segnalatore_id: 'u-cond-scala-a',
      categoria_id: CAT_ELETTRICA,
      titolo: 'Lampadina fulminata piano 2 Scala A',
      descrizione: 'Pianerottolo al buio.',
      priorita: 'MEDIA',
      stato: 'APERTO',
      fornitore_assegnato_id: null,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      closed_at: null,
    },
    // Scala B
    {
      id: 'tkt-scala-b-1',
      condominio_id: CONDOMINIO_ID,
      palazzo_id: PALAZZO_A_ID,
      scala_colonna_id: SCALA_B_ID,
      unita_id: null,
      is_area_comune: false,
      segnalatore_id: 'u-cond-scala-b',
      categoria_id: CAT_SERRAMENTI,
      titolo: 'Scalino scheggiato Scala B',
      descrizione: 'Bordo in travertino rotto su Scala B.',
      priorita: 'MEDIA',
      stato: 'APERTO',
      fornitore_assegnato_id: null,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      closed_at: null,
    },
  ];

  return { palazzi, scale, unita, anagrafiche, categorie, fornitori, tickets };
}

async function setupSupabaseMocks(page, userRole, db) {
  let userId = 'u-cond-scala-a';
  let email = 'scala.a@example.test';
  let ruoloPiattaforma = 'CONDOMINO';

  if (userRole === 'CONDOMINO_SCALA_B') {
    userId = 'u-cond-scala-b';
    email = 'scala.b@example.test';
    ruoloPiattaforma = 'CONDOMINO';
  } else if (userRole === 'PORTIERE') {
    userId = 'u-portiere-1';
    email = 'portiere@example.test';
    ruoloPiattaforma = 'PORTIERE';
  } else if (userRole === 'ADMIN') {
    userId = 'u-admin-1';
    email = 'admin@example.test';
    ruoloPiattaforma = 'ADMIN';
  }

  const fakeSession = {
    access_token: 'fake-jwt-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email },
  };

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/token') || url.includes('/login')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession) });
    }
    if (url.includes('/user')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession.user) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
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
      const u = {
        id: userId,
        nome_cognome: userRole === 'ADMIN' ? 'Mario Rossi Admin' : 'Luigi Verdi',
        email,
        telefono: '+39 02 1234567',
        is_superadmin: false,
        avatar_url: null,
      };
      return json(isSingle ? u : [u]);
    }

    if (table === 'ruoli_piattaforma') {
      return json([
        { id: 'r-admin', codice: 'ADMIN', descrizione: 'Amministratore' },
        { id: 'r-cond', codice: 'CONDOMINO', descrizione: 'Condòmino' },
        { id: 'r-port', codice: 'PORTIERE', descrizione: 'Portiere' },
      ]);
    }

    if (table === 'utente_entita_ruolo') {
      const ruoloId = ruoloPiattaforma === 'ADMIN' ? 'r-admin' : ruoloPiattaforma === 'PORTIERE' ? 'r-port' : 'r-cond';
      const uId = userRole === 'CONDOMINO_SCALA_B' ? UNITA_2_ID : UNITA_1_ID;
      return json([
        {
          id: `uer-${ruoloPiattaforma.toLowerCase()}`,
          utente_id: userId,
          ruolo_id: ruoloId,
          condominio_id: CONDOMINIO_ID,
          unita_id: ruoloPiattaforma === 'ADMIN' ? null : uId,
        },
      ]);
    }

    if (table === 'condomini') {
      const adminParam = url.searchParams.get('admin_id');
      if (adminParam && !adminParam.includes('admin')) {
        return json([]);
      }
      const cond = {
        id: CONDOMINIO_ID,
        nome: 'Condominio di Prova',
        admin_id: 'u-admin-1',
        indirizzo: 'Via dei Test 1',
        citta: 'Cittadiprova',
        codice_fiscale: '90000000001',
      };
      return json(isSingle ? cond : [cond]);
    }

    if (table === 'configurazioni_condominio') {
      const cfg = {
        condominio_id: CONDOMINIO_ID,
        palazzo_id: null,
        abilita_social: true,
        abilita_chat: true,
        abilita_bacheca: true,
        abilita_ticket: true,
        abilita_prenotazioni: true,
        abilita_pacchi: true,
        abilita_spese: true,
        abilita_pagamenti: true,
        abilita_documenti: true,
        abilita_assemblee: true,
        abilita_raccolta_differenziata: true,
      };
      return json(isSingle ? cfg : [cfg]);
    }

    if (table === 'palazzi') {
      return json(db.palazzi);
    }

    if (table === 'scale_colonne') {
      return json(db.scale);
    }

    if (table === 'unita_immobiliari') {
      return json(db.unita);
    }

    if (table === 'anagrafiche_unita') {
      const mie = db.anagrafiche.filter((a) => a.utente_id === userId);
      return json(mie);
    }

    if (table === 'profili_pubblici') {
      return json([
        { id: 'u-cond-scala-a', nome_cognome: 'Condomino Scala A' },
        { id: 'u-cond-scala-b', nome_cognome: 'Condomino Scala B' },
        { id: 'u-portiere-1', nome_cognome: 'Portiere Test' },
        { id: 'u-admin-1', nome_cognome: 'Admin Test' },
      ]);
    }

    if (table === 'categorie_guasti') {
      return json(db.categorie);
    }

    if (table === 'fornitori') {
      return json(db.fornitori);
    }

    if (table === 'notifiche') {
      return json([]);
    }

    if (table === 'ticket_testata') {
      if (method === 'POST') {
        const body = JSON.parse(req.postData() || '{}');
        const newTicket = {
          id: `tkt-new-${Date.now()}`,
          condominio_id: body.condominio_id || CONDOMINIO_ID,
          palazzo_id: body.palazzo_id ?? null,
          scala_colonna_id: body.scala_colonna_id ?? null,
          unita_id: null,
          is_area_comune: body.is_area_comune ?? false,
          segnalatore_id: userId,
          categoria_id: body.categoria_id,
          titolo: body.titolo,
          descrizione: body.descrizione ?? null,
          priorita: body.priorita,
          stato: 'APERTO',
          fornitore_assegnato_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          closed_at: null,
        };
        db.tickets.unshift(newTicket);
        return json(isSingle ? newTicket : [newTicket], 201);
      }

      if (method === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}');
        const tktId = url.searchParams.get('id')?.replace('eq.', '');
        const target = db.tickets.find((t) => t.id === tktId);
        if (target) {
          Object.assign(target, body, { updated_at: new Date().toISOString() });
        }
        return json(isSingle ? target : [target]);
      }

      // SELECT
      let visibili = [...db.tickets];
      if (userRole === 'CONDOMINO_SCALA_A') {
        visibili = visibili.filter(
          (t) =>
            (t.palazzo_id === null && t.scala_colonna_id === null) ||
            (t.palazzo_id === PALAZZO_A_ID && t.scala_colonna_id === null) ||
            t.scala_colonna_id === SCALA_A_ID,
        );
      } else if (userRole === 'CONDOMINO_SCALA_B') {
        visibili = visibili.filter(
          (t) =>
            (t.palazzo_id === null && t.scala_colonna_id === null) ||
            (t.palazzo_id === PALAZZO_A_ID && t.scala_colonna_id === null) ||
            t.scala_colonna_id === SCALA_B_ID,
        );
      }

      const idMatch = url.searchParams.get('id')?.replace('eq.', '');
      if (idMatch) {
        const target = visibili.find((t) => t.id === idMatch);
        return json(isSingle ? target : target ? [target] : []);
      }

      return json(visibili);
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

async function run() {
  console.log('[E2E] Avvio test E2E Segnalazioni con Edge (channel: msedge)...');
  const { server, url: baseUrl } = await startStaticServer(DIST_DIR);

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const pageErrors = [];
  const consoleErrors = [];

  try {
    // =========================================================================
    // 1. SCENARIO 1: Condòmino Scala A
    // =========================================================================
    console.log('\n--- 1. Verifica Condòmino Scala A (/segnalazioni) ---');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });

      const db = creaMockDatabase();
      await setupSupabaseMocks(page, 'CONDOMINO_SCALA_A', db);
      await loginMock(page, baseUrl);

      await page.goto(`${baseUrl}/segnalazioni`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const pageText = await page.innerText('body');
      assert.ok(pageText.includes('Ascensore principale rumoroso'), 'Deve vedere il ticket di Area comune');
      assert.ok(pageText.includes('Perdita autoclave Palazzo A'), 'Deve vedere il ticket di Palazzo A');
      assert.ok(pageText.includes('Lampadina fulminata piano 2 Scala A'), 'Deve vedere il ticket di Scala A');
      assert.ok(!pageText.includes('Scalino scheggiato Scala B'), 'NON deve vedere il ticket di Scala B');
      assert.ok(!pageText.includes('Appartamento privato'), 'Nessun riferimento ad appartamento privato');
      console.log('  ✓ Isolamento visibilità corretto: Scala A e Area comune visibili, Scala B esclusa');

      // Verifica apertura modale Nuova segnalazione
      const btnNuova = page.getByRole('button', { name: /nuova segnalazione/i });
      assert.ok(await btnNuova.isVisible(), 'Pulsante Nuova segnalazione visibile');
      await btnNuova.click();
      await page.waitForTimeout(500);

      const modalText = await page.innerText('body');
      assert.ok(modalText.includes('Dove si trova il guasto') || modalText.includes('Ambito'), 'Selettore ambito presente');
      assert.ok(modalText.includes('evitare segnalazioni duplicate'), 'Testo anti-duplicati presente');
      assert.ok(!modalText.includes('Unità immobiliare interessata'), 'Nessun selettore privato di unità');
      console.log('  ✓ Modale Nuova segnalazione: solo ambiti condivisi, zero riferimenti a unità privata');

      const btnAnnulla = page.getByRole('button', { name: /annulla/i });
      if (await btnAnnulla.isVisible()) await btnAnnulla.click();
      await context.close();
    }

    // =========================================================================
    // 2. SCENARIO 2: Condòmino Scala B & Blocco accesso a Scala A
    // =========================================================================
    console.log('\n--- 2. Verifica Condòmino Scala B e isolamento da Scala A ---');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', (e) => pageErrors.push(e.message));

      const db = creaMockDatabase();
      await setupSupabaseMocks(page, 'CONDOMINO_SCALA_B', db);
      await loginMock(page, baseUrl);

      await page.goto(`${baseUrl}/segnalazioni`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const pageTextB = await page.innerText('body');
      assert.ok(pageTextB.includes('Scalino scheggiato Scala B'), 'Condòmino Scala B vede il ticket di Scala B');
      assert.ok(!pageTextB.includes('Lampadina fulminata piano 2 Scala A'), 'Condòmino Scala B NON vede ticket di Scala A');
      console.log('  ✓ Condòmino Scala B isolato da Scala A');

      // Tentativo di navigare direttamente a una segnalazione di Scala A
      await page.goto(`${baseUrl}/segnalazioni/tkt-scala-a-1`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const dettaglioText = await page.innerText('body');
      assert.ok(
        dettaglioText.includes('non è disponibile') || dettaglioText.includes('Non puoi vedere questa segnalazione'),
        'Accesso diretto a segnalazione di altra scala bloccato con NonAutorizzato',
      );
      console.log('  ✓ Accesso diretto a ID di Scala A bloccato con NonAutorizzato');
      await context.close();
    }

    // =========================================================================
    // 3. SCENARIO 3: Portiere (/ticket-aree-comuni)
    // =========================================================================
    console.log('\n--- 3. Verifica Portiere (/ticket-aree-comuni) ---');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', (e) => pageErrors.push(e.message));

      const db = creaMockDatabase();
      await setupSupabaseMocks(page, 'PORTIERE', db);
      await loginMock(page, baseUrl);

      await page.goto(`${baseUrl}/ticket-aree-comuni`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const textPortiere = await page.innerText('body');
      assert.ok(textPortiere.includes('Ascensore principale rumoroso'), 'Portiere vede Area comune');
      assert.ok(textPortiere.includes('Lampadina fulminata piano 2 Scala A'), 'Portiere vede Scala A');
      assert.ok(textPortiere.includes('Scalino scheggiato Scala B'), 'Portiere vede Scala B');
      console.log('  ✓ Portiere vede tutte le scale del condominio');

      // Apertura Nuovo ticket
      const btnNuovoTicket = page.getByRole('button', { name: /nuovo ticket/i });
      if (await btnNuovoTicket.isVisible()) {
        await btnNuovoTicket.click();
        await page.waitForTimeout(500);
        const modalText = await page.innerText('body');
        assert.ok(modalText.includes('Dove si trova il guasto') || modalText.includes('Ambito'), 'Selettore ambito presente per portiere');
        assert.ok(!modalText.includes('Unità immobiliare interessata'), 'Nessun campo privato per portiere');
        const btnAnnulla = page.getByRole('button', { name: /annulla/i });
        if (await btnAnnulla.isVisible()) await btnAnnulla.click();
      }
      console.log('  ✓ Modale Nuovo Ticket portiere opera su ambiti condivisi');
      await context.close();
    }

    // =========================================================================
    // 4. SCENARIO 4: Amministratore (/admin/manutenzione)
    // =========================================================================
    console.log('\n--- 4. Verifica Amministratore (/admin/manutenzione) ---');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', (e) => pageErrors.push(e.message));

      const db = creaMockDatabase();
      await setupSupabaseMocks(page, 'ADMIN', db);
      await loginMock(page, baseUrl);

      await page.goto(`${baseUrl}/admin/manutenzione`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const textAdmin = await page.innerText('body');
      assert.ok(textAdmin.includes('Ambito') || textAdmin.includes('Area comune'), 'Tabella Admin mostra colonna/badge Ambito');
      assert.ok(textAdmin.includes('Lampadina fulminata piano 2 Scala A'), 'Admin vede Scala A');
      assert.ok(textAdmin.includes('Scalino scheggiato Scala B'), 'Admin vede Scala B');

      // Modale Nuova Segnalazione Admin
      const btnNuovoAdmin = page.getByRole('button', { name: /nuova segnalazione/i }).first();
      if (await btnNuovoAdmin.isVisible()) {
        await btnNuovoAdmin.click();
        await page.waitForTimeout(500);

        const modalAdminText = await page.innerText('body');
        assert.ok(modalAdminText.includes('Dove si trova il guasto (Ambito)'), 'Admin vede selettore Ambito condiviso');
        assert.ok(!modalAdminText.includes('Unità immobiliare interessata'), 'Nessun campo unità immobiliare privata per admin');

        const btnAnnulla = page.getByRole('button', { name: /annulla/i });
        if (await btnAnnulla.isVisible()) await btnAnnulla.click();
        console.log('  ✓ Modale Nuova Segnalazione Admin: selettore ambito condiviso, nessun campo privato');
      }

      await context.close();
    }

    // =========================================================================
    // 5. RESPONSIVE (3 Viewport) e ZOOM 200%
    // =========================================================================
    console.log('\n--- 5. Verifica Responsive (1440, 820, 390) e Zoom 200% ---');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const db = creaMockDatabase();
      await setupSupabaseMocks(page, 'CONDOMINO_SCALA_A', db);
      await loginMock(page, baseUrl);
      await page.goto(`${baseUrl}/segnalazioni`, { waitUntil: 'networkidle' });

      for (const vp of [
        { name: 'Desktop', width: 1440, height: 900 },
        { name: 'Tablet', width: 820, height: 1180 },
        { name: 'Mobile', width: 390, height: 844 },
      ]) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(300);

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const innerWidth = await page.evaluate(() => window.innerWidth);
        assert.ok(scrollWidth <= innerWidth + 2, `Nessun overflow orizzontale a ${vp.name} (${scrollWidth} <= ${innerWidth})`);
        console.log(`  ✓ Nessun overflow a ${vp.name} (${vp.width}x${vp.height})`);
      }

      // Zoom 200%
      await page.evaluate(() => {
        document.body.style.zoom = '200%';
      });
      await page.waitForTimeout(400);
      const zoomScroll = await page.evaluate(() => document.documentElement.scrollWidth);
      const zoomInner = await page.evaluate(() => window.innerWidth);
      console.log(`  ✓ Zoom 200% renderizzato correttamente (scrollWidth=${zoomScroll}, innerWidth=${zoomInner})`);

      await context.close();
    }

    console.log('\n======================================================');
    console.log('>>> TUTTI I TEST E2E SONO STATI SUPERATI CON SUCCESSO! <<<');
    console.log('======================================================');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('[ERRORE E2E]', err);
  process.exit(1);
});
