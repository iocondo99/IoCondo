import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { BUCKET_FOTO_GUASTI, DURATA_LINK_FOTO_SECONDI } from '../segnalazioniLogic.ts';
import { createSegnalazioniService } from '../segnalazioniService.ts';

const USER = '00000000-0000-0000-0000-000000000901';
const COND_A = '00000000-0000-0000-0000-000000000001';
const COND_B = '00000000-0000-0000-0000-000000000002';
const UNITA_1 = '00000000-0000-0000-0000-000000000201';
const UNITA_2 = '00000000-0000-0000-0000-000000000202';
const PALAZZO_A = 'p-a';
const T_PROPRIO = 't-proprio';
const T_UNITA_1 = 't-unita-1';
const T_UNITA_2 = 't-unita-2';
const T_AREA = 't-area';
const T_ALTRO_COND = 't-altro';

function riga(id: string, over: Record<string, unknown>) {
  return {
    id,
    condominio_id: COND_A,
    unita_id: null,
    segnalatore_id: null,
    categoria_id: null,
    titolo: id,
    descrizione: null,
    is_area_comune: false,
    priorita: 'MEDIA',
    stato: 'APERTO',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    closed_at: null,
    ...over,
  };
}

function creaMock(opz: { unita?: string[]; file?: string[]; uploadFallisce?: boolean } = {}) {
  const unita = opz.unita ?? [UNITA_1];
  const file = new Set(opz.file ?? []);
  const ticket = [
    riga(T_PROPRIO, { segnalatore_id: USER, is_area_comune: true }),
    riga(T_UNITA_1, { unita_id: UNITA_1 }),
    riga(T_UNITA_2, { unita_id: UNITA_2 }),
    riga(T_AREA, { is_area_comune: true }),
    riga(T_ALTRO_COND, { condominio_id: COND_B, is_area_comune: true, unita_id: null }),
  ];
  const inserimenti: Array<{ tabella: string; valori: any }> = [];
  const uploads: string[] = [];
  const signed: Array<{ path: string; exp: number }> = [];
  let publicUrl = false;

  const allegati = [
    { id: 'al1', ticket_id: T_UNITA_1, url_storage: `${COND_A}/${T_UNITA_1}/foto.jpg`, tipo_file: 'FOTO', caricato_da: USER, created_at: '2026-01-02T00:00:00Z' },
    { id: 'al2', ticket_id: T_UNITA_1, url_storage: `seed-dev/guasti/mancante.jpg`, tipo_file: 'FOTO', caricato_da: USER, created_at: '2026-01-03T00:00:00Z' },
  ];
  const messaggi = [
    { id: 'm1', ticket_id: T_UNITA_1, mittente_id: USER, messaggio: 'Ciao', timestamp: '2026-01-02T00:00:00Z' },
  ];

  const db = {
    from(tabella: string) {
      const eq = new Map<string, unknown>();
      const inn = new Map<string, unknown[]>();
      let modo: 'select' | 'insert' = 'select';
      let valori: any;
      const catena: any = {
        select() { return catena; },
        eq(c: string, v: unknown) { eq.set(c, v); return catena; },
        in(c: string, v: unknown[]) { inn.set(c, v); return catena; },
        not() { return catena; },
        or() { return catena; },
        order() { return catena; },
        insert(v: any) { modo = 'insert'; valori = v; inserimenti.push({ tabella, valori: v }); return catena; },
        async maybeSingle() { return { data: esegui()[0] ?? null, error: null }; },
        async single() {
          if (modo === 'insert') {
            return { data: { id: 'new', timestamp: '2026-01-05T00:00:00Z', ticket_id: valori.ticket_id, mittente_id: valori.mittente_id, messaggio: valori.messaggio }, error: null };
          }
          return { data: esegui()[0] ?? null, error: null };
        },
        then(ok: any, ko: any) {
          const r = modo === 'insert' ? { data: null, error: null } : { data: esegui(), error: null };
          return Promise.resolve(r).then(ok, ko);
        },
      };
      function esegui(): any[] {
        switch (tabella) {
          case 'anagrafiche_unita': return unita.map((unita_id) => ({ unita_id }));
          case 'utente_entita_ruolo': return [];
          case 'palazzi': return [{ id: PALAZZO_A }];
          case 'unita_immobiliari': {
            const tutte = [
              { id: UNITA_1, palazzo_id: PALAZZO_A, interno: '1', piano: 1 },
              { id: UNITA_2, palazzo_id: PALAZZO_A, interno: '2', piano: 1 },
            ];
            const ids = inn.get('id') ?? [];
            return tutte.filter((u) => ids.includes(u.id));
          }
          case 'categorie_guasti': return [{ id: 'c1', nome: 'Idraulica' }];
          case 'profili_pubblici': return [{ id: USER, nome_cognome: 'Mario Rossi' }];
          case 'ticket_testata':
            // simula RLS admin: restituisce tutto, anche altro condominio
            return ticket.filter((t) => !eq.has('id') || t.id === eq.get('id'));
          case 'ticket_allegati': return allegati.filter((a) => a.ticket_id === eq.get('ticket_id'));
          case 'ticket_messaggi': return messaggi.filter((m) => m.ticket_id === eq.get('ticket_id'));
          default: return [];
        }
      }
      return catena;
    },
    storage: {
      from(bucket: string) {
        return {
          async list(cartella: string, o?: { search?: string }) {
            const completo = `${cartella}/${o?.search ?? ''}`;
            return bucket === BUCKET_FOTO_GUASTI && file.has(completo)
              ? { data: [{ name: o?.search }], error: null }
              : { data: [], error: null };
          },
          async createSignedUrl(path: string, exp: number) {
            signed.push({ path, exp });
            return { data: { signedUrl: `https://s.test/${path}?e=${exp}` }, error: null };
          },
          async upload(path: string) {
            uploads.push(path);
            return opz.uploadFallisce ? { data: null, error: { message: 'ko' } } : { data: { path }, error: null };
          },
          getPublicUrl() { publicUrl = true; return { data: { publicUrl: 'x' } }; },
        };
      },
    },
  };
  return {
    db: db as unknown as TypedSupabaseClient,
    inserimenti,
    uploads,
    signed,
    get publicUrl() { return publicUrl; },
  };
}

describe('segnalazioniService — isolamento', () => {
  it('il condòmino vede proprio ticket e quelli della sua unità, non unità 2 né altro condominio', async () => {
    const { db } = creaMock();
    const s = createSegnalazioniService(db);
    const r = await s.elencoSegnalazioniCondomino(USER, COND_A);
    assert.deepEqual(r.map((t) => t.id).sort(), [T_PROPRIO, T_UNITA_1].sort());
  });

  it('senza unità (es. admin in vista residente) vede solo i propri ticket', async () => {
    const { db } = creaMock({ unita: [] });
    const r = await createSegnalazioniService(db).elencoSegnalazioniCondomino(USER, COND_A);
    assert.deepEqual(r.map((t) => t.id), [T_PROPRIO]);
  });

  it('il portiere vede solo aree comuni del condominio selezionato', async () => {
    const { db } = creaMock();
    const r = await createSegnalazioniService(db).elencoTicketPortiere(USER, COND_A);
    assert.deepEqual(r.map((t) => t.id).sort(), [T_AREA, T_PROPRIO].sort());
  });

  it('unitaDelResidenteNelCondominio restituisce le unità del condominio', async () => {
    const { db } = creaMock();
    const u = await createSegnalazioniService(db).unitaDelResidenteNelCondominio(USER, COND_A);
    assert.equal(u.length, 1);
    assert.equal(u[0]?.etichetta, 'Unità Int. 1 · Piano 1');
  });
});

describe('segnalazioniService — dettaglio', () => {
  it('restituisce null per ID inesistente, unità altrui e altro condominio', async () => {
    const { db } = creaMock();
    const s = createSegnalazioniService(db);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, 'boh'), null);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, T_UNITA_2), null);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, T_ALTRO_COND), null);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, T_AREA), null);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, T_UNITA_1, 'portiere'), null);
  });

  it('include messaggi con nome e allegati con link firmato 600 s solo se presenti nello Storage', async () => {
    const m = creaMock({ file: [`${COND_A}/${T_UNITA_1}/foto.jpg`] });
    const d = await createSegnalazioniService(m.db).dettaglioSegnalazione(USER, COND_A, T_UNITA_1);
    assert.ok(d);
    assert.equal(d.messaggi[0]?.mittenteNome, 'Mario Rossi');
    assert.equal(d.categoriaNome, null);
    assert.equal(d.allegati.length, 2);
    assert.equal(d.allegati[0]?.disponibileNelloStorage, true);
    assert.equal(d.allegati[1]?.disponibileNelloStorage, false);
    assert.equal(d.allegati[1]?.signedUrl, null);
    assert.deepEqual(m.signed, [{ path: `${COND_A}/${T_UNITA_1}/foto.jpg`, exp: DURATA_LINK_FOTO_SECONDI }]);
    assert.equal(m.publicUrl, false);
  });

  it('il portiere apre il dettaglio di un ticket area comune', async () => {
    const { db } = creaMock();
    const d = await createSegnalazioniService(db).dettaglioSegnalazione(USER, COND_A, T_AREA, 'portiere');
    assert.equal(d?.id, T_AREA);
  });
});

describe('segnalazioniService — creazione e messaggi', () => {
  const foto = { name: 'Foto 1.jpg', size: 10, type: 'image/jpeg', body: new Uint8Array([1]) };

  it('crea ticket, carica foto e registra allegati FOTO', async () => {
    const m = creaMock();
    const r = await createSegnalazioniService(m.db).creaSegnalazione(USER, COND_A, {
      titolo: 'Perdita',
      isAreaComune: false,
      unitaId: UNITA_1,
      allegati: [foto],
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    const t = m.inserimenti.find((i) => i.tabella === 'ticket_testata')!.valori;
    assert.equal(t.segnalatore_id, USER);
    assert.equal(t.unita_id, UNITA_1);
    assert.equal(m.uploads.length, 1);
    assert.ok(m.uploads[0]!.startsWith(`${COND_A}/${r.ticketId}/`));
    assert.ok(!m.uploads[0]!.includes('..'));
    const all = m.inserimenti.find((i) => i.tabella === 'ticket_allegati')!.valori;
    assert.equal(all.tipo_file, 'FOTO');
    assert.equal(all.url_storage, m.uploads[0]);
    assert.deepEqual(r.fotoNonCaricate, []);
  });

  it('rifiuta unità altrui e input non validi senza scrivere', async () => {
    const m = creaMock();
    const s = createSegnalazioniService(m.db);
    const r1 = await s.creaSegnalazione(USER, COND_A, { titolo: 'x', isAreaComune: false, unitaId: UNITA_2 });
    assert.equal(r1.ok, false);
    const r2 = await s.creaSegnalazione(USER, COND_A, { titolo: ' ', isAreaComune: true });
    assert.equal(r2.ok, false);
    assert.equal(m.inserimenti.length, 0);
  });

  it('il portiere forza area comune e unita_id nullo', async () => {
    const m = creaMock();
    await createSegnalazioniService(m.db).creaSegnalazione(
      USER, COND_A, { titolo: 'Cancello', isAreaComune: false, unitaId: UNITA_2 }, 'portiere',
    );
    const t = m.inserimenti.find((i) => i.tabella === 'ticket_testata')!.valori;
    assert.equal(t.is_area_comune, true);
    assert.equal(t.unita_id, null);
  });

  it('segnala le foto non caricate se l’upload fallisce', async () => {
    const m = creaMock({ uploadFallisce: true });
    const r = await createSegnalazioniService(m.db).creaSegnalazione(USER, COND_A, {
      titolo: 'T', isAreaComune: true, allegati: [foto],
    });
    assert.ok(r.ok && r.fotoNonCaricate.length === 1);
    assert.equal(m.inserimenti.some((i) => i.tabella === 'ticket_allegati'), false);
  });

  it('invia messaggi con mittente = utente e rifiuta ticket non visibili', async () => {
    const m = creaMock();
    const s = createSegnalazioniService(m.db);
    const ok = await s.aggiungiMessaggio(USER, COND_A, T_UNITA_1, ' Aggiornamento ');
    assert.ok(ok.ok);
    const ins = m.inserimenti.find((i) => i.tabella === 'ticket_messaggi')!.valori;
    assert.equal(ins.mittente_id, USER);
    assert.equal(ins.messaggio, 'Aggiornamento');
    const ko = await s.aggiungiMessaggio(USER, COND_A, T_UNITA_2, 'ciao');
    assert.equal(ko.ok, false);
    const vuoto = await s.aggiungiMessaggio(USER, COND_A, T_UNITA_1, '  ');
    assert.equal(vuoto.ok, false);
  });
});

