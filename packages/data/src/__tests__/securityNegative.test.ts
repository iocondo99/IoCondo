/**
 * Suite di test negativi difensivi (sicurezza statica/logica in locale):
 * verifica che sanitizzatori, validatori di input/importi/upload, controlli path/redirect
 * e guardie di isolamento ruoli/tenant neutralizzino o rifiutino input malevoli senza
 * alcuna chiamata verso ambienti remoti.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { validaChiusuraTicket, generaUrlMagicLink } from '../admin/manutenzioneLogic.ts';
import { createManutenzioneService } from '../admin/manutenzioneService.ts';
import { sanitizzaNomeFileDb, validaUploadDocumento } from '../admin/documentiAdminService.ts';
import { parseValoreMillesimale } from '../admin/strutturaLogic.ts';
import { validaModificaNumeroEmergenza } from '../assistenza/assistenzaLogic.ts';
import { readPasswordLink, safeReturnPath } from '../auth/authMessages.ts';
import { creaFondo, validaERegistraMovimentoFondo } from '../contabilita/fondiLogic.ts';
import {
  BUCKET_DOCUMENTI_CONDOMINIO,
  documentoVisibileAResidente,
  validaPercorsoDocumentoStorage,
} from '../documenti/documentiLogic.ts';
import {
  costruisciMittenteAmministratore,
  escapeHtml,
  generaTemplateBollettinoEmesso,
  generaTemplateComunicazioneImportante,
  generaTemplateConvocazioneAssemblea,
  isEmailValida,
} from '../email/codaEmailLogic.ts';
import { createDocumentiService } from '../documenti/documentiService.ts';
import { ruoliInvitabili } from '../inviti/invitiLogic.ts';
import { createPacchiService } from '../pacchi/pacchiService.ts';
import { validaRisorsaPrenotabile } from '../prenotazioni/prenotazioniLogic.ts';
import { createPrenotazioniService } from '../prenotazioni/prenotazioniService.ts';
import { vociDi } from '../profilo/navigazione.ts';
import { DEFAULT_MODULI_ATTIVI } from '../profilo/moduli.ts';
import { senzaRuoli, vistePossibili, type ProfiloUtente } from '../profilo/profiloLogic.ts';
import { generaTokenHex256, sha256Hex, sha256HexSync } from '../security/tokenCrypto.ts';
import { oscuraTestoSensibile } from '../security/redact.ts';
import {
  costruisciPercorsoFotoGuasto,
  ticketVisibileACondomino,
  validaAllegatiFotoTicket,
  validaInputNuovaSegnalazione,
  validaPercorsoFotoStorage,
} from '../segnalazioni/segnalazioniLogic.ts';
import { createSuperAdminService } from '../superadmin/superadminService.ts';
import { validaPianoUnico } from '../superadmin/superadminLogic.ts';

const COND_A = '00000000-0000-4000-8000-000000000001';
const COND_B = '00000000-0000-4000-8000-000000000002';
const UNITA_1 = '00000000-0000-4000-8000-000000000101';
const UNITA_2 = '00000000-0000-4000-8000-000000000102';
const PALAZZO_1 = '00000000-0000-4000-8000-000000000201';
const PALAZZO_2 = '00000000-0000-4000-8000-000000000202';
const SCALA_A = '00000000-0000-4000-8000-000000000301';
const SCALA_B = '00000000-0000-4000-8000-000000000302';
const TICKET_1 = '00000000-0000-4000-8000-000000000401';
const USER_1 = '00000000-0000-4000-8000-000000000901';

describe('Sicurezza — Sanitizzazione HTML e anti header-injection email', () => {
  it('escapeHtml neutralizza script, handler inline e caratteri HTML speciali', () => {
    const xss = `<script>alert(1)</script><img src=x onerror="fetch('https://evil.test')">&'`;
    const pulito = escapeHtml(xss);
    assert.ok(!pulito.includes('<script>'));
    assert.ok(!pulito.includes('<img'));
    assert.ok(!pulito.includes('"'));
    assert.ok(!pulito.includes("'"));
    assert.ok(pulito.includes('&lt;script&gt;'));
    assert.ok(pulito.includes('&quot;'));
    assert.ok(pulito.includes('&#39;'));
  });

  it('i 3 template email eseguono escape HTML completo nei corpi renderizzati', () => {
    const mittente = costruisciMittenteAmministratore({
      nomeCognome: 'Admin <script>XSS</script>\r\nBcc: attacker@evil.test',
      email: 'admin@studio.it',
    });
    assert.ok(!mittente.fromEmail.includes('\r'));
    assert.ok(!mittente.fromEmail.includes('\n'));
    assert.ok(!mittente.fromEmail.includes('<'));
    assert.ok(!mittente.fromEmail.includes('>'));

    const pay = '<script>alert("xss")</script>';
    const com = generaTemplateComunicazioneImportante(
      {
        condominioNome: `Condo ${pay}`,
        destinatarioNome: `Mario ${pay}`,
        titolo: `Titolo ${pay}`,
        corpo: `Corpo <img src=x onerror=alert(1)>`,
        ambitoLabel: `Scala ${pay}`,
      },
      mittente,
    );
    assert.ok(!com.htmlBody.includes('<script>'));
    assert.ok(!com.htmlBody.includes('<img'));
    assert.ok(com.htmlBody.includes('&lt;script&gt;'));

    const bol = generaTemplateBollettinoEmesso(
      {
        condominioNome: `Condo ${pay}`,
        destinatarioNome: `Mario ${pay}`,
        numeroProgressivo: 1,
        anno: 2026,
        totaleCentesimi: 10000,
        dataScadenza: '2026-12-31',
        causale: `<svg onload=alert(1)>`,
        ibanAccredito: 'IT60X0542811101000000123456',
        unitaLabel: 'Int. 1',
        righeDescrizione: ['Voce <script>alert(1)</script>'],
      },
      mittente,
    );
    assert.ok(!bol.htmlBody.includes('<script>'));
    assert.ok(!bol.htmlBody.includes('<svg'));

    const ass = generaTemplateConvocazioneAssemblea(
      {
        condominioNome: `Condo ${pay}`,
        destinatarioNome: `Mario ${pay}`,
        tipo: 'ORDINARIA',
        dataPrincipale: '2026-12-20T18:00:00Z',
        luogo: `<iframe src="javascript:alert(1)">`,
        linkMeet: 'https://meet.example.test/abc?<script>',
        puntiOdg: [{ ordine: 1, titolo: pay, descrizione: `<b onclick="x()">desc</b>` }],
      },
      mittente,
    );
    assert.ok(!ass.htmlBody.includes('<script>'));
    assert.ok(!ass.htmlBody.includes('<iframe'));
    assert.ok(!ass.htmlBody.includes('<b '));
  });

  it('costruisciMittenteAmministratore e isEmailValida rifiutano indirizzi malformati o con CRLF', () => {
    assert.equal(isEmailValida('utente@esempio.it\r\nBcc: evil@test.it'), false);
    assert.equal(isEmailValida('utente esempio@test.it'), false);
    assert.equal(isEmailValida('a'.repeat(320) + '@x.it'), false);

    const mittente = costruisciMittenteAmministratore({
      nomeCognome: 'Mario\r\nReply-To: evil@attacker.test',
      email: 'bad@test.it\nBcc: x@y.z',
    });
    assert.equal(mittente.replyToEmail, null);
    assert.ok(!mittente.fromEmail.includes('\r'));
    assert.ok(!mittente.fromEmail.includes('\n'));
  });
});

describe('Sicurezza — Path traversal, open redirect, schemi URL e token link', () => {
  it('safeReturnPath neutralizza open redirect, backslash, control char e loop su /login', () => {
    for (const payload of [
      '//evil.test',
      'https://evil.test/phish',
      'http://127.0.0.1/admin',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '/\\evil.test',
      '/spese\r\nSet-Cookie: a=1',
      '/spese\u0000.html',
      '/login',
      '/login?redirect=https://evil.test',
      '/login/callback',
      'spese',
      ['//evil.test'],
      null,
    ]) {
      assert.equal(safeReturnPath(payload), '/', `Payload non neutralizzato: ${String(payload)}`);
    }
    assert.equal(safeReturnPath('/admin/dashboard'), '/admin/dashboard');
  });

  it('readPasswordLink blocca mismatch di tipo, token vuoti e token eccessivi', () => {
    assert.equal(readPasswordLink({ token_hash: 'tok', type: 'recovery' }, 'invito'), null);
    assert.equal(readPasswordLink({ token_hash: 'tok', type: 'invite' }, 'recupero'), null);
    assert.equal(readPasswordLink({ token_hash: '', type: 'invite' }, 'invito'), null);
    assert.equal(readPasswordLink({ token_hash: 'a'.repeat(513), type: 'recovery' }, 'recupero'), null);
    assert.equal(readPasswordLink({ token_hash: 'tok', type: 'magiclink' }, 'recupero'), null);
  });

  it('validaPercorsoDocumentoStorage e documentiService rifiutano traversal e cross-condominio prima di createSignedUrl', async () => {
    for (const cattivo of [
      null,
      '',
      '../altro-condominio/file.pdf',
      `${COND_A}/../${COND_B}/segreto.pdf`,
      `${COND_A}\\segreto.pdf`,
      `/${COND_A}/cartella/file.pdf`,
      `https://evil.test/${COND_A}/file.pdf`,
      'javascript:alert(1)',
      `${COND_B}/cartella/segreto.pdf`,
      `${BUCKET_DOCUMENTI_CONDOMINIO}/${COND_B}/cartella/segreto.pdf`,
      `${COND_A}/`,
      `${COND_A}`,
    ]) {
      assert.equal(
        validaPercorsoDocumentoStorage(cattivo, COND_A),
        null,
        `Percorso non respinto: ${String(cattivo)}`,
      );
    }

    let signedUrlChiamato = false;
    const mockDb = {
      storage: {
        from() {
          return {
            async list() {
              return { data: [], error: null };
            },
            async createSignedUrl() {
              signedUrlChiamato = true;
              return { data: { signedUrl: 'https://signed.example.test' }, error: null };
            },
          };
        },
      },
    } as unknown as TypedSupabaseClient;

    const svc = createDocumentiService(mockDb);
    await assert.rejects(
      svc.creaLinkFirmatoDocumento(`${COND_B}/privato/bilancio.pdf`, COND_A),
      /Percorso del documento non valido/,
    );
    await assert.rejects(
      svc.creaLinkFirmatoDocumento(`${COND_A}/../../etc/passwd`, COND_A),
      /Percorso del documento non valido/,
    );
    assert.equal(signedUrlChiamato, false);
  });

  it('validaPercorsoFotoStorage e costruisciPercorsoFotoGuasto bloccano traversal e ticket estranei', () => {
    assert.equal(validaPercorsoFotoStorage(`${COND_B}/${TICKET_1}/foto.jpg`, COND_A, TICKET_1), null);
    assert.equal(validaPercorsoFotoStorage(`${COND_A}/altro-ticket/foto.jpg`, COND_A, TICKET_1), null);
    assert.equal(validaPercorsoFotoStorage(`${COND_A}/${TICKET_1}/../foto.jpg`, COND_A, TICKET_1), null);
    assert.equal(costruisciPercorsoFotoGuasto(`${COND_A}/..`, TICKET_1, 'foto.jpg'), null);
    assert.equal(costruisciPercorsoFotoGuasto(COND_A, `${TICKET_1}/../x`, 'foto.jpg'), null);
  });

  it('generaUrlMagicLink esegue encoding del token prevenendo path injection', () => {
    const url = generaUrlMagicLink('abc/../admin?x=1#frag', 'https://app.iocondo.test/');
    assert.equal(url, 'https://app.iocondo.test/fornitore/abc%2F..%2Fadmin%3Fx%3D1%23frag');
    assert.equal(generaUrlMagicLink('', 'https://app.iocondo.test'), '');
  });
});

describe('Sicurezza — Validazione importi negativi/zero, millesimi e upload', () => {
  it('creaFondo e validaERegistraMovimentoFondo rifiutano importi negativi/zero e violazioni RC-J2/RC-J4', () => {
    assert.throws(
      () =>
        creaFondo({
          condominioId: COND_A,
          nome: 'Fondo cassa',
          tipo: 'CASSA',
          saldoInizialeCent: -100,
        }),
      /negativo/,
    );

    assert.throws(
      () =>
        creaFondo({
          condominioId: COND_A,
          nome: 'Fondo lavori tetto',
          tipo: 'SPECIALE',
          deliberaCostituzione: 'Delibera 12/2026',
          importoLavoriCent: 0,
        }),
      /obbligatorio indicare l'importo dei lavori/,
    );

    assert.throws(
      () =>
        validaERegistraMovimentoFondo({
          fondo: {
            id: 'f-1',
            condominio_id: COND_A,
            nome: 'Fondo speciale',
            tipo: 'SPECIALE',
            stato: 'VINCOLATO',
            saldo_attuale_centesimi: 100_000,
            importo_obiettivo_centesimi: 100_000,
            delibera_costituzione: 'Delibera 1',
            esercizio_id: null,
          },
          data: '2026-05-01',
          importoCent: 0,
          segno: '-',
          causale: 'Tentativo zero',
        }),
      /maggiore di zero/,
    );

    assert.throws(
      () =>
        validaERegistraMovimentoFondo({
          fondo: {
            id: 'f-1',
            condominio_id: COND_A,
            nome: 'Fondo speciale',
            tipo: 'SPECIALE',
            stato: 'VINCOLATO',
            saldo_attuale_centesimi: 100_000,
            importo_obiettivo_centesimi: 100_000,
            delibera_costituzione: 'Delibera 1',
            esercizio_id: null,
          },
          data: '2026-05-01',
          importoCent: 10_000,
          segno: '-',
          causale: 'Compenso amministratore',
          isCompensoAdmin: true,
        }),
      /RC-J4/,
    );
  });

  it('validatori di prenotazioni, manutenzione, struttura e superadmin rifiutano importi negativi/non validi', () => {
    const risNeg = validaRisorsaPrenotabile({ nome: 'Sala riunioni', tariffa_oraria: -10, max_ore: 2 });
    assert.equal(risNeg.ok, false);
    assert.ok(risNeg.errori.tariffa_oraria);

    const risMaxZero = validaRisorsaPrenotabile({ nome: 'Sala riunioni', tariffa_oraria: 10, max_ore: 0 });
    assert.equal(risMaxZero.ok, false);
    assert.ok(risMaxZero.errori.max_ore);

    const risInf = validaRisorsaPrenotabile({ nome: 'Sala riunioni', tariffa_oraria: Infinity, max_ore: 1 });
    assert.equal(risInf.ok, false);

    const pianoNeg = validaPianoUnico(-5, 'Piano Base');
    assert.ok(pianoNeg?.prezzoMensile);

    const pianoNaN = validaPianoUnico('non-valido', 'Piano Base');
    assert.ok(pianoNaN?.prezzoMensile);

    const chiusuraNeg = validaChiusuraTicket({ importoConsuntivo: -25 });
    assert.equal(chiusuraNeg.valido, false);

    assert.equal(parseValoreMillesimale('-15,250'), null);
    assert.equal(parseValoreMillesimale('abc'), null);
  });

  it('validaAllegatiFotoTicket blocca file eseguibili/HTML, file vuoti, over-size e quantità eccessiva', () => {
    assert.ok(
      validaAllegatiFotoTicket([
        { name: 'payload.html', type: 'text/html', size: 512 },
      ]),
    );
    assert.ok(
      validaAllegatiFotoTicket([
        { name: 'virus.exe', type: 'application/x-msdownload', size: 1024 },
      ]),
    );
    assert.ok(
      validaAllegatiFotoTicket([
        { name: 'vuoto.jpg', type: 'image/jpeg', size: 0 },
      ]),
    );
    assert.ok(
      validaAllegatiFotoTicket([
        { name: 'gigante.png', type: 'image/png', size: 16 * 1024 * 1024 },
      ]),
    );
    assert.ok(
      validaAllegatiFotoTicket(
        Array.from({ length: 6 }, (_, i) => ({
          name: `foto-${i}.jpg`,
          type: 'image/jpeg',
          size: 1024,
        })),
      ),
    );
  });
});

describe('Sicurezza — Isolamento ruoli e multi-tenant lato logica/servizi', () => {
  it('ruoliInvitabili impedisce a un non-SuperAdmin di invitare con ruolo ADMIN', () => {
    assert.equal(ruoliInvitabili(false).includes('ADMIN'), false);
    assert.deepEqual(ruoliInvitabili(false), ['CONDOMINO', 'PORTIERE']);
    assert.equal(ruoliInvitabili(true).includes('ADMIN'), true);
  });

  it('profiloLogic e navigazione isolano viste ADMIN, SUPER_ADMIN, contabilità portiere e utenti senza ruoli', () => {
    const condomino: ProfiloUtente = {
      id: USER_1,
      email: 'cond@test.it',
      nome: 'Mario Condomino',
      telefono: null,
      avatarUrl: null,
      isSuperAdmin: false,
      condomini: [{ id: COND_A, nome: 'Condo A', indirizzo: null, citta: null, attivo: true }],
      assegnazioni: [{ ruolo: 'CONDOMINO', condominioId: COND_A }],
    };
    assert.deepEqual(vistePossibili(condomino, COND_A), ['RESIDENTE']);
    assert.equal(vistePossibili(condomino, COND_B).length, 0);

    const vociCond = vociDi({
      vista: 'RESIDENTE',
      ruoli: new Set(['CONDOMINO']),
      moduli: DEFAULT_MODULI_ATTIVI,
    });
    assert.equal(vociCond.some((v) => v.route.startsWith('/admin')), false);
    assert.equal(vociCond.some((v) => v.route.startsWith('/superadmin')), false);
    assert.equal(vociCond.some((v) => v.id === 'pacchi'), false);

    const vociPortiereSolo = vociDi({
      vista: 'RESIDENTE',
      ruoli: new Set(['PORTIERE']),
      moduli: DEFAULT_MODULI_ATTIVI,
    });
    assert.equal(vociPortiereSolo.some((v) => v.id === 'spese' || v.id === 'pagamenti'), false);

    const orfano: ProfiloUtente = {
      ...condomino,
      condomini: [],
      assegnazioni: [],
    };
    assert.equal(senzaRuoli(orfano), true);
  });

  it('documentoVisibileAResidente e ticketVisibileACondomino negano accesso cross-unità, cross-scala e cross-condominio', () => {
    assert.equal(
      documentoVisibileAResidente({ condominioId: COND_A, unitaId: UNITA_2 }, COND_A, [UNITA_1]),
      false,
    );
    assert.equal(
      documentoVisibileAResidente({ condominioId: COND_B, unitaId: null }, COND_A, [UNITA_1]),
      false,
    );

    assert.equal(
      ticketVisibileACondomino(
        { condominioId: COND_A, palazzoId: PALAZZO_2, scalaColonnaId: null },
        USER_1,
        COND_A,
        [PALAZZO_1],
        [SCALA_A],
      ),
      false,
    );
    assert.equal(
      ticketVisibileACondomino(
        { condominioId: COND_A, palazzoId: PALAZZO_1, scalaColonnaId: SCALA_B },
        USER_1,
        COND_A,
        [PALAZZO_1],
        [SCALA_A],
      ),
      false,
    );

    const esitoAmbitoAltrui = validaInputNuovaSegnalazione(
      {
        titolo: 'Guasto in altro palazzo',
        ambitoTipo: 'PALAZZO',
        palazzoId: PALAZZO_2,
        priorita: 'ALTA',
      },
      { palazzoIds: [PALAZZO_1], scalaIds: [SCALA_A] },
      'condomino',
    );
    assert.equal(esitoAmbitoAltrui.valido, false);
    assert.ok(esitoAmbitoAltrui.errori.ambito);
  });

  it('createPacchiService con utente CONDOMINO isola i pacchi alle sole unità attive e non espone pacchi di vicini', async () => {
    const pacchiDb = [
      {
        id: 'pacco-mio',
        condominio_id: COND_A,
        unita_destinazione_id: UNITA_1,
        registrato_da: null,
        mittente_esterno: 'Corriere A',
        stato: 'GIACENZA' as const,
        data_arrivo: '2026-05-01T10:00:00Z',
        data_ritiro: null,
        firma_ritiro: null,
      },
      {
        id: 'pacco-vicino',
        condominio_id: COND_A,
        unita_destinazione_id: UNITA_2,
        registrato_da: null,
        mittente_esterno: 'Corriere Segreto',
        stato: 'GIACENZA' as const,
        data_arrivo: '2026-05-01T11:00:00Z',
        data_ritiro: null,
        firma_ritiro: null,
      },
    ];

    const makeBuilder = (rows: Array<Record<string, unknown>>) => {
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      const b: Record<string, unknown> = {
        select() {
          return b;
        },
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return b;
        },
        in(col: string, vals: unknown[]) {
          const set = new Set(vals);
          filters.push((r) => set.has(r[col]));
          return b;
        },
        not(col: string, op: string, val: unknown) {
          if (op === 'is' && val === null) {
            filters.push((r) => r[col] !== null && r[col] !== undefined);
          }
          return b;
        },
        or() {
          return b;
        },
        order() {
          return b;
        },
        async maybeSingle() {
          const out = rows.filter((r) => filters.every((f) => f(r)));
          return { data: out[0] ?? null, error: null };
        },
        then(resolve: (v: { data: unknown[]; error: null }) => void) {
          const out = rows.filter((r) => filters.every((f) => f(r)));
          resolve({ data: out, error: null });
        },
      };
      return b;
    };

    const mockDb = {
      from(table: string) {
        if (table === 'utente_entita_ruolo') {
          return makeBuilder([
            { utente_id: USER_1, ruolo_id: 'r-cond', condominio_id: COND_A, unita_id: UNITA_1 },
          ]);
        }
        if (table === 'ruoli_piattaforma') {
          return makeBuilder([{ id: 'r-cond', codice: 'CONDOMINO' }]);
        }
        if (table === 'condomini') {
          return makeBuilder([{ id: COND_A, admin_id: 'altro-admin' }]);
        }
        if (table === 'palazzi') {
          return makeBuilder([{ id: PALAZZO_1, condominio_id: COND_A, nome_identificativo: 'Palazzo A' }]);
        }
        if (table === 'unita_immobiliari') {
          return makeBuilder([
            { id: UNITA_1, interno: '1', palazzo_id: PALAZZO_1 },
            { id: UNITA_2, interno: '2', palazzo_id: PALAZZO_1 },
          ]);
        }
        if (table === 'anagrafiche_unita') {
          return makeBuilder([{ utente_id: USER_1, unita_id: UNITA_1, data_fine: null }]);
        }
        if (table === 'registro_pacchi') {
          return makeBuilder(pacchiDb);
        }
        return makeBuilder([]);
      },
    } as unknown as TypedSupabaseClient;

    const svc = createPacchiService(mockDb);
    // Anche passando flag client manipolati (isPortiereOAdmin / ruoli), il servizio verifica lato DB.
    const visibili = await svc.elencoPacchi(COND_A, USER_1, {
      isPortiereOAdmin: true,
      ruoli: ['ADMIN', 'PORTIERE'],
    });
    assert.equal(visibili.length, 1);
    assert.equal(visibili[0]?.id, 'pacco-mio');
  });

  it('pacchiService: ruolo senza condominio_id (null) non eleva i privilegi e portineria evita colonne catastali', async () => {
    const pacchiDb = [
      {
        id: 'pacco-mio',
        condominio_id: COND_A,
        unita_destinazione_id: UNITA_1,
        registrato_da: null,
        mittente_esterno: 'Poste',
        stato: 'GIACENZA',
        data_arrivo: '2026-11-10T10:00:00Z',
        data_ritiro: null,
        firma_ritiro: null,
      },
      {
        id: 'pacco-vicino',
        condominio_id: COND_A,
        unita_destinazione_id: UNITA_2,
        registrato_da: null,
        mittente_esterno: 'Corriere',
        stato: 'GIACENZA',
        data_arrivo: '2026-11-10T09:00:00Z',
        data_ritiro: null,
        firma_ritiro: null,
      },
    ];
    const tabelleSelezionate: string[] = [];
    const campiSelezionati: string[] = [];

    const mockDb = {
      from(table: string) {
        tabelleSelezionate.push(table);
        const builder: any = {
          select(fields: string) {
            campiSelezionati.push(`${table}:${fields}`);
            return builder;
          },
          eq: () => builder,
          in: () => builder,
          not: () => builder,
          or: () => builder,
          order: () => builder,
          maybeSingle: async () => ({ data: { admin_id: 'altro' }, error: null }),
          then(resolve: (v: { data: unknown[]; error: null }) => void) {
            if (table === 'utente_entita_ruolo') {
              return resolve({
                data: [{ utente_id: USER_1, ruolo_id: 'r-port', condominio_id: null, unita_id: null }],
                error: null,
              });
            }
            if (table === 'ruoli_piattaforma') {
              return resolve({ data: [{ id: 'r-port', codice: 'PORTIERE' }], error: null });
            }
            if (table === 'palazzi') {
              return resolve({ data: [{ id: PALAZZO_1, condominio_id: COND_A, nome_identificativo: 'Palazzo A' }], error: null });
            }
            if (table === 'unita_portineria') {
              return resolve({
                data: [{ id: UNITA_1, interno: '1', piano: 1, palazzo_id: PALAZZO_1 }],
                error: null,
              });
            }
            if (table === 'anagrafiche_unita') {
              return resolve({ data: [{ unita_id: UNITA_1 }], error: null });
            }
            if (table === 'unita_immobiliari') {
              return resolve({ data: [{ id: UNITA_1, interno: '1', palazzo_id: PALAZZO_1 }], error: null });
            }
            if (table === 'registro_pacchi') {
              return resolve({ data: [pacchiDb[0]], error: null });
            }
            return resolve({ data: [], error: null });
          },
        };
        return builder;
      },
    } as unknown as TypedSupabaseClient;

    const svc = createPacchiService(mockDb);
    const visibili = await svc.elencoPacchi(COND_A, USER_1);
    assert.equal(visibili.length, 1);
    assert.equal(visibili[0]?.id, 'pacco-mio');

    const unita = await svc.elencoUnitaCondominio(COND_A);
    assert.equal(unita.length, 1);
    assert.ok(tabelleSelezionate.includes('unita_portineria'));
    assert.ok(!campiSelezionati.some((c) => /foglio_catastale|particella|subalterno|\bmq\b/i.test(c)));
  });

  it('codaEmailLogic rimuove CR/LF/NUL dagli oggetti email e rifiuta header injection in isEmailValida', () => {
    const mittente = costruisciMittenteAmministratore({ nomeCognome: 'Mario\r\nRossi\0', email: 'm@studio.it' });
    const comm = generaTemplateComunicazioneImportante(
      {
        condominioNome: 'Palazzo\r\nBcc:evil@attacker.test',
        titolo: 'Avviso\nSubject: Phishing\0',
        corpo: 'Corpo',
        ambitoLabel: 'Condominio',
      },
      mittente,
    );
    assert.ok(!/[\r\n\0]/.test(comm.oggetto));

    const boll = generaTemplateBollettinoEmesso(
      {
        condominioNome: 'Condominio\r\nX-Evil:1',
        numeroProgressivo: 1,
        anno: 2026,
        totaleCentesimi: 1000,
        dataScadenza: '2026-12-01',
      },
      mittente,
    );
    assert.ok(!/[\r\n\0]/.test(boll.oggetto));

    const ass = generaTemplateConvocazioneAssemblea(
      {
        condominioNome: 'Condominio\r\nX-Evil:2',
        tipo: 'ORDINARIA',
        dataPrincipale: '2026-12-01T18:00:00Z',
        puntiOdg: [],
      },
      mittente,
    );
    assert.ok(!/[\r\n\0]/.test(ass.oggetto));
    assert.equal(isEmailValida('user@example.com\r\nBcc:evil@test'), false);
    assert.equal(isEmailValida('user\0@example.com'), false);
  });

  it('validatori bloccano Infinity, NaN, notazione scientifica e URL tel: non numerici', () => {
    assert.equal(validaChiusuraTicket({ importoConsuntivo: Infinity }).valido, false);
    assert.equal(validaChiusuraTicket({ importoConsuntivo: 'Infinity' }).valido, false);
    assert.equal(validaChiusuraTicket({ importoConsuntivo: 'NaN' }).valido, false);
    assert.equal(validaChiusuraTicket({ importoConsuntivo: '12e5' }).valido, false);
    assert.equal(validaChiusuraTicket({ importoConsuntivo: '150.25' }).valido, true);

    assert.equal(parseValoreMillesimale('Infinity'), null);
    assert.equal(parseValoreMillesimale('NaN'), null);
    assert.equal(parseValoreMillesimale('12,345'), 12.345);

    assert.equal(validaModificaNumeroEmergenza({ titolo: 'Emergenza', numero: 'javascript:alert(1)' }).valido, false);
    assert.equal(validaModificaNumeroEmergenza({ titolo: 'Emergenza', numero: 'https://evil.test' }).valido, false);
    assert.equal(validaModificaNumeroEmergenza({ titolo: 'Emergenza', numero: 'solo-lettere' }).valido, false);
    assert.equal(validaModificaNumeroEmergenza({ titolo: 'Pronto intervento', numero: '+39 02 1234-5678' }).valido, true);
  });

  it('documentiAdminService rifiuta upload fuori MIME/estensione/50MB e sanifica nome_file per DB', () => {
    assert.match(validaUploadDocumento({ nomeFile: 'malware.exe', tipoMime: 'application/x-msdownload', dimensioneBytes: 1024 }) ?? '', /Formato/);
    assert.match(validaUploadDocumento({ nomeFile: 'payload.html', tipoMime: 'text/html', dimensioneBytes: 256 }) ?? '', /Formato/);
    assert.match(validaUploadDocumento({ nomeFile: 'verbale.pdf', tipoMime: 'text/html', dimensioneBytes: 256 }) ?? '', /MIME/);
    assert.match(validaUploadDocumento({ nomeFile: 'vuoto.pdf', tipoMime: 'application/pdf', dimensioneBytes: 0 }) ?? '', /vuoto/);
    assert.match(validaUploadDocumento({ nomeFile: 'enorme.pdf', tipoMime: 'application/pdf', dimensioneBytes: 60 * 1024 * 1024 }) ?? '', /50 MB/);
    assert.equal(validaUploadDocumento({ nomeFile: 'verbale.pdf', tipoMime: 'application/pdf', dimensioneBytes: 2048 }), null);

    const pulito = sanitizzaNomeFileDb('../../secret\r\n<script>.pdf\0');
    assert.ok(!pulito.includes('..'));
    assert.ok(!pulito.includes('\r'));
    assert.ok(!pulito.includes('\n'));
    assert.ok(!pulito.includes('\0'));
    assert.ok(!pulito.includes('<'));
  });

  it('tokenCrypto e manutenzioneService generano token 256-bit e salvano solo digest SHA-256 in fornitori_tokens', async () => {
    const t1 = generaTokenHex256();
    const t2 = generaTokenHex256();
    assert.match(t1, /^[0-9a-f]{64}$/);
    assert.notEqual(t1, t2);
    assert.equal(
      await sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    assert.equal(
      sha256HexSync('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );

    const insertedTokenRows: Array<Record<string, unknown>> = [];
    const mockDb = {
      from(table: string) {
        if (table === 'ticket_interventi') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'int-1' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'fornitori_tokens') {
          return {
            insert: (payload: Record<string, unknown>) => {
              insertedTokenRows.push(payload);
              return {
                select: () => ({
                  single: async () => ({ data: { token: payload.token }, error: null }),
                }),
              };
            },
          };
        }
        if (table === 'ticket_testata') {
          return {
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as TypedSupabaseClient;

    const svc = createManutenzioneService(mockDb);
    const assegnato = await svc.assegnaFornitore({
      ticketId: TICKET_1,
      fornitoreId: 'forn-1',
      baseUrl: 'https://app.iocondo.it/fornitore',
    });

    assert.match(assegnato.token, /^[0-9a-f]{64}$/);
    assert.equal(insertedTokenRows.length, 1);
    const salvato = insertedTokenRows[0]!;
    assert.notEqual(salvato.token, assegnato.token);
    assert.equal(salvato.token, await sha256Hex(assegnato.token));
    assert.equal(salvato.url_magico, null);
  });

  it('superadminService usa la RPC lato DB per risolvere utenti verificati (rifiutando lookup email modificabili client-side)', async () => {
    const rpcChiamate: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const mockDb = {
      from(table: string) {
        if (table === 'piani_abbonamento') {
          return {
            select: () => ({
              order: async () => ({
                data: [{
                  id: 'piano-1',
                  nome: 'Piano Unico IoCondo',
                  prezzo_mensile: 29,
                  limite_unita: null,
                  feature_premium: {},
                  updated_at: '2026-11-01T00:00:00Z',
                }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`Lookup non autorizzato sulla tabella ${table}`);
      },
      async rpc(fn: string, args: Record<string, unknown>) {
        rpcChiamate.push({ fn, args });
        return { data: null, error: { code: 'PGRST202', message: 'function not found' } };
      },
    } as unknown as TypedSupabaseClient;

    const svc = createSuperAdminService(mockDb);
    await assert.rejects(
      () => svc.invitaAmministratore('admin@studio.it', 'Mario Rossi'),
      /21_fix_sicurezza\.sql/,
    );
    assert.equal(rpcChiamate[0]?.fn, 'risolvi_utente_verificato_da_email');
    assert.equal(rpcChiamate[0]?.args.p_email, 'admin@studio.it');
  });

  it('prenotazioniService utilizza elenco_slot_prenotazioni RPC mascherando dati personali altrui', async () => {
    const mockDb = {
      async rpc(fn: string) {
        assert.equal(fn, 'elenco_slot_prenotazioni');
        return {
          data: [
            {
              id: 'p-altrui',
              risorsa_id: 'ris-1',
              utente_id: null,
              data_inizio: '2026-12-01T10:00:00Z',
              data_fine: '2026-12-01T11:00:00Z',
              costo_addebitato: null,
              created_at: '2026-11-25T10:00:00Z',
              risorsa_nome: 'Sala condominiale',
              tariffa_oraria: 15,
              utente_nome: null,
              utente_email: null,
              is_mia: false,
            },
          ],
          error: null,
        };
      },
      from() {
        throw new Error('Non deve interrogare direttamente prenotazioni_spazi quando la RPC esiste');
      },
    } as unknown as TypedSupabaseClient;

    const svc = createPrenotazioniService(mockDb);
    const slots = await svc.elencoPrenotazioniCondominio(COND_A);
    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.utente_id, '');
    assert.equal(slots[0]?.utente_nome, null);
    assert.equal(slots[0]?.utente_email, null);
    assert.equal(slots[0]?.costo_addebitato, 0);
  });

  it('oscuraTestoSensibile rimuove email, Bearer, JWT, UUID, token hex, IBAN e numeri lunghi', () => {
    const raw = [
      'Utente mario.rossi@example.com',
      'Authorization: Bearer abcDEF123.456',
      'JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature_part',
      'ID 550e8400-e29b-41d4-a716-446655440000',
      'Magic 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      'IBAN IT60X0542811101000000123456',
      'Tel 3331234567',
    ].join(' | ');
    const sanitized = oscuraTestoSensibile(raw);
    assert.ok(!sanitized.includes('mario.rossi@example.com'));
    assert.ok(!sanitized.includes('abcDEF123.456'));
    assert.ok(!sanitized.includes('eyJhbGciOiJIUzI1NiJ9'));
    assert.ok(!sanitized.includes('550e8400-e29b-41d4-a716-446655440000'));
    assert.ok(!sanitized.includes('0123456789abcdef0123456789abcdef'));
    assert.ok(!sanitized.includes('IT60X0542811101000000123456'));
    assert.ok(!sanitized.includes('3331234567'));
  });
});
