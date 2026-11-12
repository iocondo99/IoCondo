import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { BUCKET_FOTO_GUASTI, DURATA_LINK_FOTO_SECONDI } from '../segnalazioniLogic.ts';
import { createSegnalazioniService } from '../segnalazioniService.ts';

const USER = '00000000-0000-0000-0000-000000000901';
const COND_A = '00000000-0000-0000-0000-000000000001';
const COND_B = '00000000-0000-0000-0000-000000000002';
const UNITA_1 = '00000000-0000-0000-0000-000000000201';
const PALAZZO_A = 'p-a';
const SCALA_A = 's-a';
const SCALA_B = 's-b';

const T_AREA = 't-area';
const T_PALAZZO = 't-palazzo';
const T_SCALA_A = 't-scala-a';
const T_SCALA_B = 't-scala-b';
const T_ALTRO_COND = 't-altro';

function riga(id: string, over: Record<string, unknown>) {
  return {
    id,
    condominio_id: COND_A,
    unita_id: null,
    palazzo_id: null,
    scala_colonna_id: null,
    segnalatore_id: null,
    categoria_id: null,
    titolo: id,
    descrizione: null,
    is_area_comune: true,
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
    riga(T_AREA, { palazzo_id: null, scala_colonna_id: null }),
    riga(T_PALAZZO, { palazzo_id: PALAZZO_A, scala_colonna_id: null }),
    riga(T_SCALA_A, { palazzo_id: PALAZZO_A, scala_colonna_id: SCALA_A }),
    riga(T_SCALA_B, { palazzo_id: PALAZZO_A, scala_colonna_id: SCALA_B }),
    riga(T_ALTRO_COND, { condominio_id: COND_B, palazzo_id: null, scala_colonna_id: null }),
  ];
  const inserimenti: Array<{ tabella: string; valori: any }> = [];
  const uploads: string[] = [];
  const signed: Array<{ path: string; exp: number }> = [];
  let publicUrl = false;

  const allegati = [
    { id: 'al1', ticket_id: T_SCALA_A, url_storage: `${COND_A}/${T_SCALA_A}/foto.jpg`, tipo_file: 'FOTO', caricato_da: USER, created_at: '2026-01-02T00:00:00Z' },
    { id: 'al2', ticket_id: T_SCALA_A, url_storage: `seed-dev/guasti/mancante.jpg`, tipo_file: 'FOTO', caricato_da: USER, created_at: '2026-01-03T00:00:00Z' },
  ];
  const messaggi = [
    { id: 'm1', ticket_id: T_SCALA_A, mittente_id: USER, messaggio: 'Ciao', timestamp: '2026-01-02T00:00:00Z' },
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
          case 'palazzi': {
            const condId = eq.get('condominio_id');
            if (condId && condId !== COND_A) return [];
            return [{ id: PALAZZO_A, nome_identificativo: 'Palazzo A', condominio_id: COND_A }];
          }
          case 'scale_colonne': {
            const ids = inn.get('id');
            const tutte = [
              { id: SCALA_A, nome: 'Scala A', palazzo_id: PALAZZO_A, palazzi: { nome_identificativo: 'Palazzo A' } },
              { id: SCALA_B, nome: 'Scala B', palazzo_id: PALAZZO_A, palazzi: { nome_identificativo: 'Palazzo A' } },
            ];
            return ids ? tutte.filter((s) => ids.includes(s.id)) : tutte;
          }
          case 'unita_immobiliari': {
            const tutte = [
              { id: UNITA_1, palazzo_id: PALAZZO_A, scala_colonna_id: SCALA_A, interno: '1', piano: 1 },
            ];
            const ids = inn.get('id') ?? [];
            return tutte.filter((u) => ids.includes(u.id));
          }
          case 'categorie_guasti': return [{ id: 'c1', nome: 'Idraulica' }];
          case 'profili_pubblici': return [{ id: USER, nome_cognome: 'Mario Rossi' }];
          case 'ticket_testata':
            return ticket.filter((t) => (!eq.has('condominio_id') || t.condominio_id === eq.get('condominio_id')) && (!eq.has('id') || t.id === eq.get('id')));
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

describe('segnalazioniService — isolamento per ambiti condivisi', () => {
  it('il condòmino di Scala A vede Area comune, proprio Palazzo e Scala A; NON vede Scala B né altro condominio', async () => {
    const { db } = creaMock();
    const s = createSegnalazioniService(db);
    const r = await s.elencoSegnalazioniCondomino(USER, COND_A);
    const ids = r.map((t) => t.id).sort();
    assert.deepEqual(ids, [T_AREA, T_PALAZZO, T_SCALA_A].sort());
    assert.equal(ids.includes(T_SCALA_B), false);
    assert.equal(ids.includes(T_ALTRO_COND), false);
  });

  it('il portiere vede tutte le segnalazioni (Area comune, Palazzo, Scala A, Scala B) del condominio attivo', async () => {
    const { db } = creaMock();
    const s = createSegnalazioniService(db);
    const r = await s.elencoTicketPortiere(USER, COND_A);
    const ids = r.map((t) => t.id).sort();
    assert.deepEqual(ids, [T_AREA, T_PALAZZO, T_SCALA_A, T_SCALA_B].sort());
    assert.equal(ids.includes(T_ALTRO_COND), false);
  });

  it('ambitiSelezionabili: restituisce solo Area comune, proprio Palazzo e Scala A per il condòmino', async () => {
    const { db } = creaMock();
    const s = createSegnalazioniService(db);
    const opz = await s.ambitiSelezionabili(USER, COND_A, 'condomino');
    assert.equal(opz.length, 3);
    assert.equal(opz[0]?.tipo, 'CONDOMINIO');
    assert.equal(opz[1]?.tipo, 'PALAZZO');
    assert.equal(opz[2]?.tipo, 'SCALA');
    assert.equal(opz[2]?.scalaColonnaId, SCALA_A);
  });
});

describe('segnalazioniService — dettaglio', () => {
  it('restituisce null per ID inesistente, altra scala (Scala B) e altro condominio', async () => {
    const { db } = creaMock();
    const s = createSegnalazioniService(db);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, 'boh'), null);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, T_SCALA_B), null);
    assert.equal(await s.dettaglioSegnalazione(USER, COND_A, T_ALTRO_COND), null);
  });

  it('include messaggi con nome e allegati con link firmato 600 s solo se presenti nello Storage', async () => {
    const m = creaMock({ file: [`${COND_A}/${T_SCALA_A}/foto.jpg`] });
    const d = await createSegnalazioniService(m.db).dettaglioSegnalazione(USER, COND_A, T_SCALA_A);
    assert.ok(d);
    assert.equal(d.messaggi[0]?.mittenteNome, 'Mario Rossi');
    assert.equal(d.categoriaNome, null);
    assert.equal(d.allegati.length, 2);
    assert.equal(d.allegati[0]?.disponibileNelloStorage, true);
    assert.equal(d.allegati[1]?.disponibileNelloStorage, false);
    assert.equal(d.allegati[1]?.signedUrl, null);
    assert.deepEqual(m.signed, [{ path: `${COND_A}/${T_SCALA_A}/foto.jpg`, exp: DURATA_LINK_FOTO_SECONDI }]);
    assert.equal(m.publicUrl, false);
  });
});

describe('segnalazioniService — creazione e messaggi', () => {
  const foto = { name: 'Foto 1.jpg', size: 10, type: 'image/jpeg', body: new Uint8Array([1]) };

  it('crea ticket su Scala A senza unita_id (sempre null)', async () => {
    const m = creaMock();
    const r = await createSegnalazioniService(m.db).creaSegnalazione(USER, COND_A, {
      titolo: 'Lampadina fulminata',
      ambitoTipo: 'SCALA',
      palazzoId: PALAZZO_A,
      scalaColonnaId: SCALA_A,
      allegati: [foto],
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    const t = m.inserimenti.find((i) => i.tabella === 'ticket_testata')!.valori;
    assert.equal(t.segnalatore_id, USER);
    assert.equal(t.unita_id, null);
    assert.equal(t.palazzo_id, PALAZZO_A);
    assert.equal(t.scala_colonna_id, SCALA_A);
    assert.equal(t.is_area_comune, true);
    assert.equal(m.uploads.length, 1);
    assert.ok(m.uploads[0]!.startsWith(`${COND_A}/${r.ticketId}/`));
  });

  it('rifiuta creazione su Scala B da parte del condòmino di Scala A', async () => {
    const m = creaMock();
    const s = createSegnalazioniService(m.db);
    const r = await s.creaSegnalazione(USER, COND_A, {
      titolo: 'Guasto non consentito',
      ambitoTipo: 'SCALA',
      palazzoId: PALAZZO_A,
      scalaColonnaId: SCALA_B,
    });
    assert.equal(r.ok, false);
    assert.equal(m.inserimenti.length, 0);
  });

  it('invia messaggi con mittente = utente e rifiuta ticket non visibili', async () => {
    const m = creaMock();
    const s = createSegnalazioniService(m.db);
    const ok = await s.aggiungiMessaggio(USER, COND_A, T_SCALA_A, ' Aggiornamento ');
    assert.ok(ok.ok);
    const ins = m.inserimenti.find((i) => i.tabella === 'ticket_messaggi')!.valori;
    assert.equal(ins.mittente_id, USER);
    assert.equal(ins.messaggio, 'Aggiornamento');
    const ko = await s.aggiungiMessaggio(USER, COND_A, T_SCALA_B, 'ciao');
    assert.equal(ko.ok, false);
  });
});
