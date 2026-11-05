import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  arrotonda3,
  calcolaQuadraturaTabella,
  confrontaInterni,
  costruisciAlberoStruttura,
  generaTemplateCSVMillesimi,
  isAnagraficaAttiva,
  parseCSVMatrice,
  parseValoreMillesimale,
  selezionaResidenteAttivo,
  validaImportMillesimiCSV,
  type AnagraficaUnitaRaw,
  type PalazzoRaw,
  type QuotaMillesimaleRaw,
  type ScalaColonnaRaw,
  type TabellaMillesimaleRaw,
  type TipologiaUnitaRaw,
  type UnitaDettaglioView,
  type UnitaImmobiliareRaw,
} from '../strutturaLogic.ts';

test('parseValoreMillesimale: gestisce formati numerici italiani ed esteri', () => {
  assert.equal(parseValoreMillesimale('100'), 100);
  assert.equal(parseValoreMillesimale('125,50'), 125.5);
  assert.equal(parseValoreMillesimale('125.50'), 125.5);
  assert.equal(parseValoreMillesimale(' 240,123 ‰ '), 240.123);
  assert.equal(parseValoreMillesimale('1.000,000'), 1000);
  assert.equal(parseValoreMillesimale('0,000'), 0);
  assert.equal(parseValoreMillesimale('-50'), null);
  assert.equal(parseValoreMillesimale('abc'), null);
  assert.equal(parseValoreMillesimale(''), null);
});

test('parseCSVMatrice: gestisce separatori virgola, punto e virgola e virgolette', () => {
  const csvPuntoEVirgola = 'Scala;Interno;Millesimi\r\nScala A;1;250,000\r\nScala A;2;250,000';
  const parsed1 = parseCSVMatrice(csvPuntoEVirgola);
  assert.equal(parsed1.length, 3);
  assert.deepEqual(parsed1[0], ['Scala', 'Interno', 'Millesimi']);
  assert.deepEqual(parsed1[1], ['Scala A', '1', '250,000']);

  const csvVirgolaConQuotes = 'Scala,Interno,Millesimi\n"Scala, B",1,300.000\nScala B,2,700.000';
  const parsed2 = parseCSVMatrice(csvVirgolaConQuotes);
  assert.equal(parsed2.length, 3);
  assert.deepEqual(parsed2[1], ['Scala, B', '1', '300.000']);
});

test('confrontaInterni: ordinamento naturale', () => {
  const interni = ['10', '1', '2', 'B1', 'A1', '20'];
  interni.sort(confrontaInterni);
  assert.deepEqual(interni, ['1', '2', '10', '20', 'A1', 'B1']);
});

test('isAnagraficaAttiva e selezionaResidenteAttivo: preferisce proprietario attivo', () => {
  const oggi = '2026-11-05';

  const anagrafiche: AnagraficaUnitaRaw[] = [
    {
      id: 'a1',
      unita_id: 'u1',
      utente_id: 'usr1',
      tipo_possesso: 'INQUILINO',
      data_inizio: '2025-01-01',
      data_fine: null,
      quota_possesso: 100,
      utente: { id: 'usr1', nome_cognome: 'Mario Inquilino' },
    },
    {
      id: 'a2',
      unita_id: 'u1',
      utente_id: 'usr2',
      tipo_possesso: 'PROPRIETARIO',
      data_inizio: '2024-01-01',
      data_fine: null,
      quota_possesso: 100,
      utente: { id: 'usr2', nome_cognome: 'Luigi Proprietario' },
    },
    {
      id: 'a3',
      unita_id: 'u1',
      utente_id: 'usr3',
      tipo_possesso: 'PROPRIETARIO',
      data_inizio: '2020-01-01',
      data_fine: '2023-12-31', // scaduto
      quota_possesso: 100,
      utente: { id: 'usr3', nome_cognome: 'Ex Proprietario' },
    },
  ];

  assert.equal(isAnagraficaAttiva(anagrafiche[0], oggi), true);
  assert.equal(isAnagraficaAttiva(anagrafiche[2], oggi), false);

  const residente = selezionaResidenteAttivo(anagrafiche, oggi);
  assert.ok(residente);
  assert.equal(residente.tipoPossesso, 'PROPRIETARIO');
  assert.equal(residente.nomeCognome, 'Luigi Proprietario');
});

test('costruisciAlberoStruttura: raggruppa correttamente per palazzo e scala', () => {
  const palazzi: PalazzoRaw[] = [
    { id: 'p1', condominio_id: 'c1', nome_identificativo: 'Palazzo A', indirizzo: 'Via Roma 1' },
    { id: 'p2', condominio_id: 'c1', nome_identificativo: 'Palazzo B', indirizzo: 'Via Roma 3' },
  ];

  const scale: ScalaColonnaRaw[] = [
    { id: 'sc1', palazzo_id: 'p1', tipo: 'SCALA', nome: 'Scala A' },
    { id: 'sc2', palazzo_id: 'p1', tipo: 'SCALA', nome: 'Scala B' },
  ];

  const tipologie: TipologiaUnitaRaw[] = [
    { id: 't1', descrizione: 'Appartamento' },
    { id: 't2', descrizione: 'Box auto' },
  ];

  const unita: UnitaImmobiliareRaw[] = [
    { id: 'u1', palazzo_id: 'p1', scala_colonna_id: 'sc1', tipologia_id: 't1', interno: '1', piano: 1, mq: 80 },
    { id: 'u2', palazzo_id: 'p1', scala_colonna_id: 'sc1', tipologia_id: 't1', interno: '2', piano: 1, mq: 70 },
    { id: 'u3', palazzo_id: 'p1', scala_colonna_id: 'sc2', tipologia_id: 't1', interno: '3', piano: 2, mq: 90 },
    { id: 'u4', palazzo_id: 'p1', scala_colonna_id: null, tipologia_id: 't2', interno: 'B1', piano: -1, mq: 15 },
    { id: 'u5', palazzo_id: 'p2', scala_colonna_id: null, tipologia_id: 't1', interno: '1', piano: 1, mq: 65 },
  ];

  const anagrafiche: AnagraficaUnitaRaw[] = [
    {
      id: 'a1',
      unita_id: 'u1',
      utente_id: 'usr1',
      tipo_possesso: 'PROPRIETARIO',
      data_inizio: '2024-01-01',
      quota_possesso: 100,
      utente: { id: 'usr1', nome_cognome: 'Gianni Morandi' },
    },
  ];

  const albero = costruisciAlberoStruttura({
    palazzi,
    scale,
    tipologie,
    unita,
    anagrafiche,
    dataRifOggi: '2026-11-05',
  });

  assert.equal(albero.palazzi.length, 2);
  assert.equal(albero.statistiche.totalePalazzi, 2);
  assert.equal(albero.statistiche.totaleUnita, 5);
  assert.equal(albero.statistiche.residentiAssociati, 1);
  assert.equal(albero.statistiche.totaleMq, 320);

  const palA = albero.palazzi.find((p) => p.id === 'p1');
  assert.ok(palA);
  assert.equal(palA.totaleUnita, 4);
  assert.equal(palA.scale.length, 3); // Scala A, Scala B, Senza scala / Generale

  const scA = palA.scale.find((s) => s.id === 'sc1');
  assert.ok(scA);
  assert.equal(scA.unita.length, 2);
  assert.equal(scA.unita[0].residenteAttivo?.nomeCognome, 'Gianni Morandi');
});

test('calcolaQuadraturaTabella: verifica quadratura esatta e disavanzo', () => {
  const tabella: TabellaMillesimaleRaw = {
    id: 'tab1',
    condominio_id: 'c1',
    nome: 'Tabella A Proprietà',
    totale: 1000,
  };

  const tutteUnita: UnitaDettaglioView[] = [
    {
      id: 'u1',
      palazzoId: 'p1',
      palazzoNome: 'Palazzo A',
      scalaId: 'sc1',
      scalaNome: 'Scala A',
      tipologiaId: 't1',
      tipologiaDescrizione: 'Appartamento',
      interno: '1',
      piano: 1,
      mq: 80,
      foglioCatastale: null,
      particella: null,
      subalterno: null,
      residenteAttivo: null,
    },
    {
      id: 'u2',
      palazzoId: 'p1',
      palazzoNome: 'Palazzo A',
      scalaId: 'sc1',
      scalaNome: 'Scala A',
      tipologiaId: 't1',
      tipologiaDescrizione: 'Appartamento',
      interno: '2',
      piano: 1,
      mq: 80,
      foglioCatastale: null,
      particella: null,
      subalterno: null,
      residenteAttivo: null,
    },
  ];

  // Caso 1: Quadrata a 1000
  const quoteQuadrate: QuotaMillesimaleRaw[] = [
    { id: 'q1', tabella_id: 'tab1', unita_id: 'u1', valore_millesimale: 600 },
    { id: 'q2', tabella_id: 'tab1', unita_id: 'u2', valore_millesimale: 400 },
  ];

  const resQuadrata = calcolaQuadraturaTabella(tabella, quoteQuadrate, tutteUnita);
  assert.equal(resQuadrata.totaleEffettivo, 1000);
  assert.equal(resQuadrata.disavanzo, 0);
  assert.equal(resQuadrata.isQuadrata, true);
  assert.equal(resQuadrata.statoQuadratura, 'QUADRATA');
  assert.equal(resQuadrata.quote[0].percentuale, 60);

  // Caso 2: Disavanzo
  const quoteDisavanzo: QuotaMillesimaleRaw[] = [
    { id: 'q1', tabella_id: 'tab1', unita_id: 'u1', valore_millesimale: 550 },
    { id: 'q2', tabella_id: 'tab1', unita_id: 'u2', valore_millesimale: 400 },
  ];

  const resDisavanzo = calcolaQuadraturaTabella(tabella, quoteDisavanzo, tutteUnita);
  assert.equal(resDisavanzo.totaleEffettivo, 950);
  assert.equal(resDisavanzo.disavanzo, 50);
  assert.equal(resDisavanzo.isQuadrata, false);
  assert.equal(resDisavanzo.statoQuadratura, 'DISAVANZO');
});

test('validaImportMillesimiCSV (UC-09): valida CSV corretto e quadratura 1000 ‰', () => {
  const unita: UnitaDettaglioView[] = [
    {
      id: 'u1',
      palazzoId: 'p1',
      palazzoNome: 'Palazzo A',
      scalaId: 'sc1',
      scalaNome: 'Scala A',
      tipologiaId: 't1',
      tipologiaDescrizione: 'Appartamento',
      interno: '1',
      piano: 1,
      mq: 80,
      foglioCatastale: null,
      particella: null,
      subalterno: null,
      residenteAttivo: null,
    },
    {
      id: 'u2',
      palazzoId: 'p1',
      palazzoNome: 'Palazzo A',
      scalaId: 'sc1',
      scalaNome: 'Scala A',
      tipologiaId: 't1',
      tipologiaDescrizione: 'Appartamento',
      interno: '2',
      piano: 1,
      mq: 80,
      foglioCatastale: null,
      particella: null,
      subalterno: null,
      residenteAttivo: null,
    },
  ];

  // CSV valido con somma 1000
  const csvValido = 'Scala;Interno;Millesimi\r\nScala A;1;600,000\r\nScala A;2;400,000';
  const val1 = validaImportMillesimiCSV(csvValido, unita);
  assert.equal(val1.isQuadrata, true);
  assert.equal(val1.puoSalvare, true);
  assert.equal(val1.righeValide, 2);
  assert.equal(val1.righeErrate, 0);
  assert.equal(val1.sommaMillesimi, 1000);

  // CSV con somma errata
  const csvErratoSomma = 'Scala;Interno;Millesimi\r\nScala A;1;500,000\r\nScala A;2;400,000';
  const val2 = validaImportMillesimiCSV(csvErratoSomma, unita);
  assert.equal(val2.isQuadrata, false);
  assert.equal(val2.puoSalvare, false);
  assert.equal(val2.disavanzo, 100);

  // CSV con colonna mancante
  const csvSenzaMillesimi = 'Scala;Interno;Altro\r\nScala A;1;600';
  const val3 = validaImportMillesimiCSV(csvSenzaMillesimi, unita);
  assert.equal(val3.puoSalvare, false);
  assert.ok(val3.erroriGlobali.some((e) => e.includes('Millesimi')));

  // CSV con riga duplicata
  const csvDuplicato = 'Scala;Interno;Millesimi\r\nScala A;1;500,000\r\nScala A;1;500,000';
  const val4 = validaImportMillesimiCSV(csvDuplicato, unita);
  assert.equal(val4.puoSalvare, false);
  assert.equal(val4.righeErrate, 1);
  assert.ok(val4.righe[1].errori.some((e) => e.includes('duplicata')));

  // CSV con unità inesistente
  const csvInesistente = 'Scala;Interno;Millesimi\r\nScala A;99;1000,000';
  const val5 = validaImportMillesimiCSV(csvInesistente, unita);
  assert.equal(val5.puoSalvare, false);
  assert.ok(val5.righe[0].errori.some((e) => e.includes('non trovata')));
});

test('generaTemplateCSVMillesimi: genera template corretto', () => {
  const unita: UnitaDettaglioView[] = [
    {
      id: 'u1',
      palazzoId: 'p1',
      palazzoNome: 'Palazzo A',
      scalaId: 'sc1',
      scalaNome: 'Scala A',
      tipologiaId: 't1',
      tipologiaDescrizione: 'Appartamento',
      interno: '1',
      piano: 1,
      mq: 80,
      foglioCatastale: null,
      particella: null,
      subalterno: null,
      residenteAttivo: null,
    },
  ];

  const template = generaTemplateCSVMillesimi(unita);
  assert.ok(template.includes('Scala;Interno;Millesimi'));
  assert.ok(template.includes('Scala A;1;0,000'));
});

