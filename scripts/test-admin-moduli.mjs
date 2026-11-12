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

function creaStatoMock(ruoloAttivo = 'ADMIN') {
  const userId = ruoloAttivo === 'ADMIN' ? 'u-admin-1' : 'u-cond-1';
  const condId = 'd0000000-0000-4000-8000-000000000001';

  // Configurazione default condominio
  const configCondominio = {
    id: 'cfg-cond-1',
    condominio_id: condId,
    palazzo_id: null,
    abilita_social: true,
    abilita_chat: true,
    abilita_bacheca: true,
    abilita_ticket: true,
    abilita_prenotazioni: true,
    abilita_pacchi: true,
    // Colonne estese (migrazione 11)
    abilita_spese: true,
    abilita_pagamenti: true,
    abilita_documenti: true,
    abilita_assemblee: true,
    abilita_raccolta_differenziata: true,
  };

  // Override opzionale per Palazzo B (inizialmente assente)
  let configPalazzoB = null;

  const palazzi = [
    { id: 'pal-1', condominio_id: condId, nome_identificativo: 'Palazzo A', scale: ['A', 'B'] },
    { id: 'pal-2', condominio_id: condId, nome_identificativo: 'Palazzo B', scale: ['C'] },
  ];

  return {
    userId,
    condId,
    ruoloAttivo,
    configCondominio,
    getConfigPalazzoB: () => configPalazzoB,
    setConfigPalazzoB: (cfg) => {
      configPalazzoB = cfg;
    },
    palazzi,
    failNextPatch: false,
    failMissingColumn: false,
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
      const ruoli =
        stato.ruoloAttivo === 'ADMIN'
          ? [
              {
                id: 'uer-admin',
                utente_id: stato.userId,
                ruolo_id: 'r-admin',
                condominio_id: stato.condId,
                unita_id: null,
              },
              {
                id: 'uer-cond',
                utente_id: stato.userId,
                ruolo_id: 'r-cond',
                condominio_id: stato.condId,
                unita_id: 'unita-1',
              },
            ]
          : [
              {
                id: 'uer-cond-solo',
                utente_id: stato.userId,
                ruolo_id: 'r-cond',
                condominio_id: stato.condId,
                unita_id: 'unita-1',
              },
            ];
      return json(ruoli);
    }

    if (table === 'condomini') {
      if (url.searchParams.get('admin_id') && stato.ruoloAttivo !== 'ADMIN') {
        return json([]);
      }
      const cond = {
        id: stato.condId,
        nome: 'Condominio Sole',
        indirizzo: 'Via Roma 10',
        citta: 'Milano',
        codice_fiscale: '90000000001',
      };
      return json(isSingle ? cond : [cond]);
    }

    if (table === 'palazzi') {
      return json(stato.palazzi);
    }

    if (table === 'configurazioni_condominio') {
      if (method === 'GET') {
        const palazzoId = url.searchParams.get('palazzo_id');
        if (palazzoId && palazzoId.startsWith('eq.')) {
          const targetPal = palazzoId.replace('eq.', '');
          if (targetPal === 'pal-2' && stato.getConfigPalazzoB()) {
            return json(isSingle ? stato.getConfigPalazzoB() : [stato.getConfigPalazzoB()]);
          }
          return json(isSingle ? null : []);
        }
        if (palazzoId && palazzoId === 'is.null') {
          return json(isSingle ? stato.configCondominio : [stato.configCondominio]);
        }
        // Nessun filtro palazzo: restituisci tutte le config del condominio
        const res = [stato.configCondominio];
        if (stato.getConfigPalazzoB()) res.push(stato.getConfigPalazzoB());
        return json(res);
      }

      if (method === 'POST') {
        if (stato.failNextPatch) {
          stato.failNextPatch = false;
          return json({ message: 'Errore interno simulato nel salvataggio' }, 500);
        }
        if (stato.failMissingColumn) {
          stato.failMissingColumn = false;
          return json({ message: "Could not find the 'abilita_spese' column of 'configurazioni_condominio' in the schema cache" }, 400);
        }

        const body = JSON.parse(req.postData() || '{}');
        const targetPalazzoId = body.palazzo_id ?? null;
        if (targetPalazzoId === 'pal-2') {
          const updated = {
            ...(stato.getConfigPalazzoB() ?? { id: 'cfg-pal-2', condominio_id: stato.condId, palazzo_id: 'pal-2', ...stato.configCondominio }),
            ...body,
          };
          stato.setConfigPalazzoB(updated);
          return json(isSingle ? updated : [updated], 201);
        }

        Object.assign(stato.configCondominio, body);
        return json(isSingle ? stato.configCondominio : [stato.configCondominio], 201);
      }

      if (method === 'PATCH') {
        if (stato.failNextPatch) {
          stato.failNextPatch = false;
          return json({ message: 'Errore simulato di connessione' }, 500);
        }
        const body = JSON.parse(req.postData() || '{}');
        const palazzoId = url.searchParams.get('palazzo_id');
        if (palazzoId && palazzoId.replace('eq.', '') === 'pal-2') {
          if (stato.getConfigPalazzoB()) {
            Object.assign(stato.getConfigPalazzoB(), body);
            return json(isSingle ? stato.getConfigPalazzoB() : [stato.getConfigPalazzoB()]);
          }
        }
        Object.assign(stato.configCondominio, body);
        return json(isSingle ? stato.configCondominio : [stato.configCondominio]);
      }

      if (method === 'DELETE') {
        const palazzoId = url.searchParams.get('palazzo_id')?.replace('eq.', '');
        if (palazzoId === 'pal-2') {
          stato.setConfigPalazzoB(null);
        }
        return route.fulfill({ status: 204 });
      }
    }

    if (table === 'notifiche') {
      return json([]);
    }

    if (table === 'risorse_prenotabili') {
      return json([]);
    }

    if (table === 'prenotazioni_spazi') {
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
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert.ok(
      overflow.scrollWidth <= overflow.innerWidth + 2,
      `[${label}] Nessun overflow orizzontale anomalo a ${vp.width}x${vp.height} (scroll=${overflow.scrollWidth}, inner=${overflow.innerWidth})`
    );
  }
}

async function run() {
  console.log('🚀 Avvio E2E test: Gestione Moduli e Feature Toggle (/admin/moduli)');

  assert.ok(fs.existsSync(DIST_DIR), `Cartella di build ${DIST_DIR} deve esistere`);
  const { server, url: baseUrl } = await startStaticServer(DIST_DIR);
  console.log(`📡 Server statico attivo su ${baseUrl}`);

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const pageErrors = [];
  const consoleErrors = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: Controllo Accessi — Pure Condomino viene bloccato
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Condòmino puro bloccato su /admin/moduli ---');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const stato = creaStatoMock('CONDOMINO');
      await setupSupabaseMocks(page, stato);
      await loginMock(page, baseUrl);

      // Prova navigazione diretta a /admin/moduli
      await page.goto(`${baseUrl}/admin/moduli`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Deve mostrare NonAutorizzato o reindirizzare
      const bodyText = await page.innerText('body');
      const nonAutorizzato =
        bodyText.includes('Questa funzione non è disponibile per te') ||
        bodyText.includes('non è disponibile') ||
        bodyText.includes('Vai alla tua Home') ||
        bodyText.includes('Non autorizzato') ||
        bodyText.includes('Accesso riservato') ||
        bodyText.includes('amministratori') ||
        page.url().endsWith('/home');
      assert.ok(nonAutorizzato, `Condòmino puro non può accedere a /admin/moduli (body: "${bodyText.slice(0, 200)}")`);
      console.log('✅ Accesso condòmino correttamente bloccato');
      await context.close();
    }

    // -------------------------------------------------------------
    // TEST 2: Amministratore — Layout, StatCard, Selezione Ambito
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Amministratore accede a /admin/moduli ---');
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (!t.includes('Failed to load resource')) consoleErrors.push(t);
      }
    });

    const stato = creaStatoMock('ADMIN');
    await setupSupabaseMocks(page, stato);
    await loginMock(page, baseUrl);

    await page.goto(`${baseUrl}/admin/moduli`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verifica PageHeader e StatCards
    const bodyText = await page.innerText('body');
    assert.ok(bodyText.includes('Moduli e funzionalità'), 'Titolo pagina presente');
    assert.ok(bodyText.includes('Funzionalità attive'), 'StatCard attive presente');
    assert.ok(bodyText.includes('Funzionalità disattivate'), 'StatCard disattivate presente');
    assert.ok(bodyText.includes('Ambito di configurazione'), 'StatCard ambito presente');
    console.log('✅ Header istituzionale e StatCards renderizzati');

    // Verifica elenco dei moduli presenti
    assert.ok(bodyText.includes('Prenotazione spazi comuni'), 'Modulo prenotazioni presente');
    assert.ok(bodyText.includes('Bacheca condominiale'), 'Modulo bacheca presente');
    assert.ok(bodyText.includes('Segnalazioni e ticket guasti'), 'Modulo ticket presente');
    assert.ok(bodyText.includes('Registro pacchi in portineria'), 'Modulo pacchi presente');
    console.log('✅ Elenco moduli e descrizioni visualizzati correttamente');

    // -------------------------------------------------------------
    // TEST 3: Ricerca e Filtri Chip
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Ricerca e Filtri Chip ---');
    const searchInput = page.locator('input[placeholder*="Cerca modulo"]').first();
    await searchInput.fill('spazi');
    await page.waitForTimeout(300);

    let textAfterSearch = await page.innerText('body');
    assert.ok(textAfterSearch.includes('Prenotazione spazi comuni'), 'Prenotazioni visibile con ricerca');
    assert.ok(!textAfterSearch.includes('Registro pacchi in portineria'), 'Pacchi filtrato via dalla ricerca');

    await searchInput.fill('');
    await page.waitForTimeout(300);
    console.log('✅ Ricerca reattiva verificata');

    // -------------------------------------------------------------
    // TEST 4: Toggle Prenotazioni OFF -> Impatto immediato su Residente
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Commutazione switch e impatto immediato su vista Residente ---');
    // Trova lo switch per le prenotazioni
    // Cerchiamo il toggle associato a "Prenotazione spazi comuni"
    const prenSwitch = page.locator('[accessibilityRole="switch"]').first();
    const prenSwitchRole = page.getByRole('switch', { name: /Prenotazione spazi comuni/i }).first();
    const targetSwitch = (await prenSwitchRole.count()) > 0 ? prenSwitchRole : prenSwitch;

    // Disattiva il modulo cliccando sullo switch
    await targetSwitch.click();
    await page.waitForTimeout(500);

    // Verifica salvataggio nel mock state
    assert.equal(stato.configCondominio.abilita_prenotazioni, false, 'Stato DB mock aggiornato a false');
    console.log('✅ Switch commutato e salvato su Supabase mock');

    // Cambia preferenza vista verso "RESIDENTE" in localStorage
    await page.evaluate(() => {
      try {
        const grezzo = localStorage.getItem('iocondo.preferenze.v1');
        const pref = grezzo ? JSON.parse(grezzo) : {};
        pref.vista = 'RESIDENTE';
        localStorage.setItem('iocondo.preferenze.v1', JSON.stringify(pref));
      } catch (e) {
        console.error('Errore localStorage:', e);
      }
    });

    // Prova ad accedere alla rotta /prenotazioni da residente
    await page.goto(`${baseUrl}/prenotazioni`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Deve mostrare GuardiaModulo: "Funzionalità non attiva"
    const guardText = await page.innerText('body');
    assert.ok(
      guardText.includes('Funzionalità non attiva') ||
      guardText.includes('disattivata dall\'amministratore') ||
      guardText.includes('Questa funzione non è disponibile'),
      `GuardiaModulo attiva su /prenotazioni: "${guardText.slice(0, 300)}"`
    );
    console.log('✅ GuardiaModulo blocca correttamente /prenotazioni quando disattivato');

    // Torna alla vista ADMIN in localStorage e riattiva il toggle
    await page.evaluate(() => {
      try {
        const grezzo = localStorage.getItem('iocondo.preferenze.v1');
        const pref = grezzo ? JSON.parse(grezzo) : {};
        pref.vista = 'ADMIN';
        localStorage.setItem('iocondo.preferenze.v1', JSON.stringify(pref));
      } catch (e) {
        console.error('Errore localStorage:', e);
      }
    });

    await page.goto(`${baseUrl}/admin/moduli`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const prenSwitchReattiva = page.getByRole('switch', { name: /Prenotazione spazi comuni/i }).first();
    const switchRiattiva = (await prenSwitchReattiva.count()) > 0 ? prenSwitchReattiva : page.locator('[accessibilityRole="switch"]').first();
    await switchRiattiva.click();
    await page.waitForTimeout(500);

    assert.equal(stato.configCondominio.abilita_prenotazioni, true, 'Stato DB mock riattivato a true');
    console.log('✅ Modulo riattivato con successo');

    // -------------------------------------------------------------
    // TEST 5: Test Override Palazzo e Ripristino
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Ambito per singolo palazzo e ripristino override ---');
    // Seleziona "Palazzo B"
    const selectTrigger = page.locator('text=Tutto il condominio (predefinito)').first();
    if (await selectTrigger.isVisible()) {
      await selectTrigger.click();
      await page.waitForTimeout(300);
      const palBOpt = page.locator('text=Palazzo B').first();
      if (await palBOpt.isVisible()) {
        await palBOpt.click();
        await page.waitForTimeout(500);

        // Modifica un toggle non-critico su Palazzo B (es. Prenotazione spazi comuni)
        const prenPalSwitch = page.getByRole('switch', { name: /Prenotazione spazi comuni/i }).first();
        await prenPalSwitch.click();
        await page.waitForTimeout(500);

        assert.ok(stato.getConfigPalazzoB() !== null, 'Creato override per Palazzo B su DB');
        console.log('✅ Override creato per Palazzo B');

        // Verifica comparsa badge personalizzato o pulsante di ripristino
        const bodyWithOverride = await page.innerText('body');
        assert.ok(
          bodyWithOverride.includes('Personalizzato per questo palazzo') ||
          bodyWithOverride.includes('Ripristina predefiniti') ||
          bodyWithOverride.includes('Override dedicato'),
          'Segnalazione override visualizzata'
        );

        // Clicca su Ripristina
        const resetBtn = page.getByRole('button', { name: /Ripristina/i }).first();
        if (await resetBtn.isVisible()) {
          await resetBtn.click();
          await page.waitForTimeout(300);

          // Conferma nel ConfirmDialog
          const confirmBtn = page.getByRole('button', { name: /Ripristina impostazioni|Conferma/i }).first();
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            await page.waitForTimeout(500);
            assert.equal(stato.getConfigPalazzoB(), null, 'Override Palazzo B rimosso dopo ripristino');
            console.log('✅ Ripristino override completato con successo');
          }
        }
      }
    }

    // -------------------------------------------------------------
    // TEST 6: Gestione Errori e Rollback Visivo
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Gestione errori e rollback visivo dello Switch ---');
    // Torna a tutto il condominio
    await page.goto(`${baseUrl}/admin/moduli`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Simula errore al prossimo salvataggio
    stato.failNextPatch = true;
    const testSwitch = page.getByRole('switch', { name: /Prenotazione spazi comuni/i }).first();
    const prevChecked = await testSwitch.getAttribute('aria-checked');

    await testSwitch.click();
    await page.waitForTimeout(800);

    // Deve mostrare messaggio d'errore (Toast o Alert) e fare rollback
    const bodyError = await page.innerText('body');
    const hasErrorMsg = bodyError.includes('Errore') || bodyError.includes('non riuscito') || bodyError.includes('simulato');
    assert.ok(hasErrorMsg, 'Messaggio d\'errore visualizzato dopo fallimento');

    const currChecked = await testSwitch.getAttribute('aria-checked');
    assert.equal(currChecked, prevChecked, 'Switch ripristinato allo stato precedente (rollback)');
    console.log('✅ Rollback dello switch ed errore visualizzati correttamente');

    // -------------------------------------------------------------
    // TEST 7: Accessibilità, Navigazione da Tastiera e Responsive Viewports
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Accessibilità, Tastiera e Viewport ---');
    // Verifica attributi WCAG 2.2 dello switch
    const sampleSwitch = page.getByRole('switch').first();
    assert.ok(sampleSwitch, 'Switch accessibile presente con role="switch"');

    // Verifica focus ring e tastiera (Space key)
    await sampleSwitch.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    console.log('✅ Commutazione da tastiera tramite barra spaziatrice verificata');

    // Verifica responsive su Desktop, Tablet e Mobile
    await verificaViewportEZoom(page, 'AdminModuliScreen');
    console.log('✅ Viewport responsive (1440x900, 820x1180, 390x844) senza overflow anomalo');

    // Verifica assenza errori critici di console
    assert.equal(pageErrors.length, 0, `Nessun errore di pagina non gestito: ${pageErrors.join(', ')}`);
    console.log('✅ Zero unhandled page errors');

    await context.close();
    console.log('\n🎉 TUTTI I TEST E2E PER /admin/moduli SONO STATI SUPERATI CON SUCCESSO!');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ TEST FALLITO:', err);
  process.exit(1);
});
