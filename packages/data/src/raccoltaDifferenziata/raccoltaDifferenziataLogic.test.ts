import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IRaccoltaDifferenziata } from '@iocondo/shared-types';
import {
  badgeGiornoRelativo,
  contestoGiorniRaccolta,
  filtraTurniRaccolta,
  giornoSettimanaDaDate,
  giornoSuccessivo,
  nomeBreveGiornoSettimana,
  nomeGiornoSettimana,
  ordinaTurniRaccolta,
  raggruppaTurniPerGiorno,
  statisticheRaccolta,
  turniDelGiorno,
  validaTurnoRaccolta,
  metadatiTipoRifiuto,
} from './raccoltaDifferenziataLogic.ts';

const turno = (
  id: string,
  giorno_settimana: number,
  tipo_rifiuto: string,
  note: string | null = null,
): IRaccoltaDifferenziata => ({
  id,
  condominio_id: 'cond-1',
  giorno_settimana,
  tipo_rifiuto,
  note,
});

const CAMPIONE: IRaccoltaDifferenziata[] = [
  turno('1', 5, 'Vetro', 'Solo campana o mastello verde entro le 7:00'),
  turno('2', 1, 'Umido / Organico', 'Esporre entro le 7:00'),
  turno('3', 1, 'Carta e cartone', 'Cartoni piegati'),
  turno('4', 3, 'Plastica e metalli', 'Sacco giallo'),
  turno('5', 4, 'Umido / Organico', 'Esporre entro le 7:00'),
];

test('mappatura giorni della settimana e calcolo Oggi/Domani', () => {
  assert.equal(nomeGiornoSettimana(1), 'Lunedì');
  assert.equal(nomeGiornoSettimana(7), 'Domenica');
  assert.equal(nomeBreveGiornoSettimana(3), 'Mer');

  // Mercoledì 11/11/2026
  const mercoledi = new Date(2026, 10, 11, 10, 0, 0);
  assert.equal(giornoSettimanaDaDate(mercoledi), 3);
  assert.deepEqual(contestoGiorniRaccolta(mercoledi), {
    oggi: 3,
    domani: 4,
    nomeOggi: 'Mercoledì',
    nomeDomani: 'Giovedì',
  });

  // Domenica 15/11/2026 (JS getDay() === 0 -> 7; domani -> 1 Lunedì)
  const domenica = new Date(2026, 10, 15, 10, 0, 0);
  assert.equal(giornoSettimanaDaDate(domenica), 7);
  assert.equal(giornoSuccessivo(7), 1);
  assert.deepEqual(contestoGiorniRaccolta(domenica), {
    oggi: 7,
    domani: 1,
    nomeOggi: 'Domenica',
    nomeDomani: 'Lunedì',
  });

  assert.equal(badgeGiornoRelativo(3, mercoledi), 'oggi');
  assert.equal(badgeGiornoRelativo(4, mercoledi), 'domani');
  assert.equal(badgeGiornoRelativo(5, mercoledi), null);
});

test('ordinamento settimanale e raggruppamento per giorno', () => {
  const ordinati = ordinaTurniRaccolta(CAMPIONE);
  assert.deepEqual(
    ordinati.map((t) => `${t.giorno_settimana}:${t.tipo_rifiuto}`),
    [
      '1:Carta e cartone',
      '1:Umido / Organico',
      '3:Plastica e metalli',
      '4:Umido / Organico',
      '5:Vetro',
    ],
  );

  const gruppi = raggruppaTurniPerGiorno(CAMPIONE);
  assert.deepEqual(
    gruppi.map((g) => g.nome),
    ['Lunedì', 'Mercoledì', 'Giovedì', 'Venerdì'],
  );
  assert.equal(gruppi[0]?.turni.length, 2);
  assert.equal(turniDelGiorno(CAMPIONE, 1).length, 2);
  assert.equal(turniDelGiorno(CAMPIONE, 2).length, 0);
});

test('statistiche raccolta differenziata', () => {
  // Mercoledì (3): 1 turno oggi (Plastica), 1 turno domani (Umido)
  const mercoledi = new Date(2026, 10, 11, 10, 0, 0);
  assert.deepEqual(statisticheRaccolta(CAMPIONE, mercoledi), {
    totaleTurni: 5,
    giorniCoperti: 4,
    turniOggi: 1,
    turniDomani: 1,
  });
});

test('filtri per giorno e ricerca testuale su tipo e note', () => {
  const perGiorno = filtraTurniRaccolta(CAMPIONE, { giorno: 1 });
  assert.equal(perGiorno.length, 2);

  const perTestoTipo = filtraTurniRaccolta(CAMPIONE, { ricerca: 'umido' });
  assert.equal(perTestoTipo.length, 2);

  const perTestoNote = filtraTurniRaccolta(CAMPIONE, { ricerca: 'campana' });
  assert.equal(perTestoNote.length, 1);
  assert.equal(perTestoNote[0]?.id, '1');

  const combinato = filtraTurniRaccolta(CAMPIONE, { giorno: 1, ricerca: 'piegati' });
  assert.equal(combinato.length, 1);
  assert.equal(combinato[0]?.id, '3');
});

test('validazione form turno raccolta', () => {
  const vuoto = validaTurnoRaccolta({ tipo_rifiuto: '   ', giorno_settimana: null, note: '' });
  assert.equal(vuoto.ok, false);
  if (!vuoto.ok) {
    assert.ok(vuoto.errori.tipo_rifiuto);
    assert.ok(vuoto.errori.giorno_settimana);
  }

  const corto = validaTurnoRaccolta({ tipo_rifiuto: 'A', giorno_settimana: 8 });
  assert.equal(corto.ok, false);
  if (!corto.ok) {
    assert.ok(corto.errori.tipo_rifiuto);
    assert.ok(corto.errori.giorno_settimana);
  }

  const noteLunghe = validaTurnoRaccolta({
    tipo_rifiuto: 'Vetro',
    giorno_settimana: 2,
    note: 'x'.repeat(301),
  });
  assert.equal(noteLunghe.ok, false);
  if (!noteLunghe.ok) {
    assert.ok(noteLunghe.errori.note);
  }

  const valido = validaTurnoRaccolta({
    tipo_rifiuto: '  Carta e cartone  ',
    giorno_settimana: 2,
    note: '   ',
  });
  assert.deepEqual(valido, {
    ok: true,
    dati: {
      tipo_rifiuto: 'Carta e cartone',
      giorno_settimana: 2,
      note: null,
    },
  });
});

test('casi limite validazione note e lunghezza tipo rifiuto', () => {
  // Note vuote stringa vs note con soli spazi -> entrambe convertite a null
  const noteVuote = validaTurnoRaccolta({ tipo_rifiuto: 'Plastica', giorno_settimana: 3, note: '' });
  assert.equal(noteVuote.ok, true);
  if (noteVuote.ok) assert.equal(noteVuote.dati.note, null);

  const noteSpazi = validaTurnoRaccolta({ tipo_rifiuto: 'Plastica', giorno_settimana: 3, note: '    \t\n  ' });
  assert.equal(noteSpazi.ok, true);
  if (noteSpazi.ok) assert.equal(noteSpazi.dati.note, null);

  const noteNull = validaTurnoRaccolta({ tipo_rifiuto: 'Plastica', giorno_settimana: 3, note: null });
  assert.equal(noteNull.ok, true);
  if (noteNull.ok) assert.equal(noteNull.dati.note, null);

  // Limiti esatti caratteri tipo_rifiuto: min 2, max 80
  const min2 = validaTurnoRaccolta({ tipo_rifiuto: 'AB', giorno_settimana: 1 });
  assert.equal(min2.ok, true);

  const max80 = validaTurnoRaccolta({ tipo_rifiuto: 'A'.repeat(80), giorno_settimana: 1 });
  assert.equal(max80.ok, true);

  const oltre80 = validaTurnoRaccolta({ tipo_rifiuto: 'A'.repeat(81), giorno_settimana: 1 });
  assert.equal(oltre80.ok, false);
});

test('metadatiTipoRifiuto associa categoria, icona e tono appropriati', () => {
  // Organico / Umido
  assert.deepEqual(metadatiTipoRifiuto('Umido / Organico'), {
    categoria: 'organico',
    icona: 'apple',
    tono: 'warning',
  });
  assert.deepEqual(metadatiTipoRifiuto('Scarti di cibo e alimentari'), {
    categoria: 'organico',
    icona: 'apple',
    tono: 'warning',
  });

  // Carta e cartone
  assert.deepEqual(metadatiTipoRifiuto('Carta e cartone'), {
    categoria: 'carta',
    icona: 'newspaper',
    tono: 'info',
  });
  assert.deepEqual(metadatiTipoRifiuto('Giornali e riviste'), {
    categoria: 'carta',
    icona: 'newspaper',
    tono: 'info',
  });

  // Plastica e metalli
  assert.deepEqual(metadatiTipoRifiuto('Plastica e metalli'), {
    categoria: 'plastica',
    icona: 'recycle',
    tono: 'warning',
  });
  assert.deepEqual(metadatiTipoRifiuto('Lattine e alluminio'), {
    categoria: 'plastica',
    icona: 'recycle',
    tono: 'warning',
  });

  // Vetro
  assert.deepEqual(metadatiTipoRifiuto('Vetro'), {
    categoria: 'vetro',
    icona: 'wine',
    tono: 'success',
  });
  assert.deepEqual(metadatiTipoRifiuto('Bottiglie di vetro'), {
    categoria: 'vetro',
    icona: 'wine',
    tono: 'success',
  });

  // Sfalci e potature
  assert.deepEqual(metadatiTipoRifiuto('Sfalci e potature'), {
    categoria: 'sfalci',
    icona: 'leaf',
    tono: 'success',
  });

  // Indifferenziato
  assert.deepEqual(metadatiTipoRifiuto('Indifferenziato'), {
    categoria: 'indifferenziato',
    icona: 'trash-2',
    tono: 'neutral',
  });
  assert.deepEqual(metadatiTipoRifiuto('Secco residuo'), {
    categoria: 'indifferenziato',
    icona: 'trash-2',
    tono: 'neutral',
  });

  // Fallback
  assert.deepEqual(metadatiTipoRifiuto('Rifiuto speciale non specificato'), {
    categoria: 'altro',
    icona: 'trash-2',
    tono: 'neutral',
  });
});

