import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  badgeStatoPacco,
  calcolaStatistichePacchi,
  filtraPacchi,
  formattaDataOraPacco,
  formattaDataPacco,
  formattaEtichettaUnitaPacco,
  ordinaPacchi,
  paginaPacchi,
  validaNuovoPacco,
  validaRegistrazioneRitiro,
  type Pacco,
} from '../pacchiLogic.ts';

const COND_ID = 'd0000000-0000-4000-8000-000000000001';

function mockPacco(dati: Partial<Pacco>): Pacco {
  return {
    id: dati.id ?? 'pacco-01',
    condominioId: dati.condominioId ?? COND_ID,
    unitaDestinazioneId: dati.unitaDestinazioneId ?? 'unita-01',
    etichettaUnita: dati.etichettaUnita ?? 'Palazzina A — Int. 1',
    mittenteEsterno: dati.mittenteEsterno ?? 'Amazon Logistics',
    stato: dati.stato ?? 'GIACENZA',
    dataArrivo: dati.dataArrivo ?? '2026-11-01T10:30:00Z',
    dataRitiro: dati.dataRitiro ?? null,
    firmaRitiro: dati.firmaRitiro ?? null,
    registratoDa: dati.registratoDa ?? 'user-portiere',
    registratoDaNome: dati.registratoDaNome ?? 'Mario Rossi',
  };
}

describe('pacchiLogic — badge di stato ed etichette unità', () => {
  it('restituisce i badge corretti per GIACENZA e RITIRATO', () => {
    assert.deepEqual(badgeStatoPacco('GIACENZA'), { status: 'in-giacenza', label: 'In giacenza' });
    assert.deepEqual(badgeStatoPacco('RITIRATO'), { status: 'ritirato', label: 'Ritirato' });
  });

  it('formatta correttamente l’etichetta unità in presenza di palazzo, scala e interno', () => {
    assert.equal(
      formattaEtichettaUnitaPacco({ palazzoNome: 'Palazzina A', scala: '1', interno: '4' }),
      'Palazzina A — Scala 1 — Int. 4',
    );
    assert.equal(
      formattaEtichettaUnitaPacco({ palazzoNome: 'Palazzo Centrale', interno: '12' }),
      'Palazzo Centrale — Int. 12',
    );
    assert.equal(
      formattaEtichettaUnitaPacco({ interno: '2' }),
      'Int. 2',
    );
  });
});

describe('pacchiLogic — formattazione data e ora (senza Intl)', () => {
  it('formatta la data e ora in italiano', () => {
    const formatted = formattaDataOraPacco('2026-10-23T11:20:00Z');
    assert.ok(formatted.includes('ott'));
    assert.ok(formatted.includes('2026'));
  });

  it('gestisce valori nulli, non definiti o date non valide', () => {
    assert.equal(formattaDataOraPacco(null), '—');
    assert.equal(formattaDataOraPacco(undefined), '—');
    assert.equal(formattaDataOraPacco('data-non-valida'), '—');
    assert.equal(formattaDataPacco(null), '—');
  });
});

describe('pacchiLogic — calcolo 3 StatCard reali', () => {
  it('calcola correttamente in giacenza, ritirati recenti e totale', () => {
    const adesso = '2026-11-04T12:00:00Z';
    const elenco: Pacco[] = [
      mockPacco({ id: 'p1', stato: 'GIACENZA' }),
      mockPacco({ id: 'p2', stato: 'GIACENZA' }),
      mockPacco({
        id: 'p3',
        stato: 'RITIRATO',
        dataRitiro: '2026-11-02T15:00:00Z', // 2 giorni fa: recente
      }),
      mockPacco({
        id: 'p4',
        stato: 'RITIRATO',
        dataRitiro: '2026-09-01T10:00:00Z', // 2 mesi fa: oltre 30 gg
      }),
    ];

    const stats = calcolaStatistichePacchi(elenco, adesso);
    assert.equal(stats.inGiacenza, 2);
    assert.equal(stats.ritiratiRecenti, 1);
    assert.equal(stats.totale, 4);
  });

  it('gestisce un elenco vuoto senza errori', () => {
    const stats = calcolaStatistichePacchi([]);
    assert.equal(stats.inGiacenza, 0);
    assert.equal(stats.ritiratiRecenti, 0);
    assert.equal(stats.totale, 0);
  });
});

describe('pacchiLogic — filtri, ricerca, ordinamento e paginazione', () => {
  const p1 = mockPacco({
    id: 'p1',
    mittenteEsterno: 'Amazon Prime',
    etichettaUnita: 'Palazzo A — Int. 1',
    stato: 'GIACENZA',
    dataArrivo: '2026-11-03T10:00:00Z',
  });
  const p2 = mockPacco({
    id: 'p2',
    mittenteEsterno: 'Poste Italiane',
    etichettaUnita: 'Palazzo A — Int. 2',
    stato: 'RITIRATO',
    dataArrivo: '2026-11-01T15:00:00Z',
  });
  const p3 = mockPacco({
    id: 'p3',
    mittenteEsterno: 'GLS Corriere',
    etichettaUnita: 'Palazzo B — Int. 1',
    stato: 'GIACENZA',
    dataArrivo: '2026-11-02T12:00:00Z',
  });
  const tuttiPacchi = [p1, p2, p3];

  it('filtra per stato', () => {
    assert.equal(filtraPacchi(tuttiPacchi, { stato: 'tutti' }).length, 3);
    assert.deepEqual(
      filtraPacchi(tuttiPacchi, { stato: 'GIACENZA' }).map((p) => p.id),
      ['p1', 'p3'],
    );
    assert.deepEqual(
      filtraPacchi(tuttiPacchi, { stato: 'RITIRATO' }).map((p) => p.id),
      ['p2'],
    );
  });

  it('cerca per mittente o per unità in modo case-insensitive', () => {
    const cercaAmazon = filtraPacchi(tuttiPacchi, { ricerca: 'amazon' });
    assert.equal(cercaAmazon.length, 1);
    assert.equal(cercaAmazon[0]?.id, 'p1');

    const cercaUnita = filtraPacchi(tuttiPacchi, { ricerca: 'palazzo b' });
    assert.equal(cercaUnita.length, 1);
    assert.equal(cercaUnita[0]?.id, 'p3');

    const cercaInterno = filtraPacchi(tuttiPacchi, { ricerca: 'int. 1' });
    assert.equal(cercaInterno.length, 2);
  });

  it('ordina per data di arrivo (predefinito decrescente)', () => {
    const ordinati = ordinaPacchi(tuttiPacchi, 'data_arrivo', 'desc');
    assert.deepEqual(ordinati.map((p) => p.id), ['p1', 'p3', 'p2']);

    const crescenti = ordinaPacchi(tuttiPacchi, 'data_arrivo', 'asc');
    assert.deepEqual(crescenti.map((p) => p.id), ['p2', 'p3', 'p1']);
  });

  it('ordina per mittente alfabetico', () => {
    const ordinati = ordinaPacchi(tuttiPacchi, 'mittente', 'asc');
    assert.deepEqual(ordinati.map((p) => p.id), ['p1', 'p3', 'p2']); // Amazon, GLS, Poste
  });

  it('pagina correttamente la lista', () => {
    const pag = paginaPacchi(tuttiPacchi, 1, 2);
    assert.equal(pag.paginaCorrente, 1);
    assert.equal(pag.totalePagine, 2);
    assert.equal(pag.elementi.length, 2);
    assert.equal(pag.totaleElementi, 3);

    const pag2 = paginaPacchi(tuttiPacchi, 2, 2);
    assert.equal(pag2.paginaCorrente, 2);
    assert.equal(pag2.elementi.length, 1);

    // Normalizzazione pagine fuori intervallo
    const pagOver = paginaPacchi(tuttiPacchi, 99, 2);
    assert.equal(pagOver.paginaCorrente, 2);
  });
});

describe('pacchiLogic — validazione inserimento e ritiro', () => {
  it('valida inserimento nuovo pacco (unità obbligatoria, mittente max 100 car)', () => {
    // Unità vuota
    const res1 = validaNuovoPacco({ unitaId: '' });
    assert.equal(res1.valido, false);
    assert.ok(res1.errori.unitaId);

    // Mittente troppo lungo
    const res2 = validaNuovoPacco({
      unitaId: 'u-1',
      mittenteEsterno: 'A'.repeat(101),
    });
    assert.equal(res2.valido, false);
    assert.ok(res2.errori.mittenteEsterno);

    // Valido con mittente
    const res3 = validaNuovoPacco({
      unitaId: 'u-1',
      mittenteEsterno: 'Amazon Corriere',
    });
    assert.equal(res3.valido, true);
    assert.deepEqual(res3.errori, {});

    // Valido anche con mittente nullo o vuoto
    const res4 = validaNuovoPacco({ unitaId: 'u-1', mittenteEsterno: '' });
    assert.equal(res4.valido, true);
  });

  it('valida registrazione ritiro (firma obbligatoria non vuota, max 100 car)', () => {
    assert.equal(validaRegistrazioneRitiro('').valido, false);
    assert.equal(validaRegistrazioneRitiro('   ').valido, false);
    assert.equal(validaRegistrazioneRitiro(null).valido, false);
    assert.equal(validaRegistrazioneRitiro('A'.repeat(101)).valido, false);

    const valida = validaRegistrazioneRitiro('Mario Rossi (delegato)');
    assert.equal(valida.valido, true);
    assert.equal(valida.errore, undefined);
  });
});

