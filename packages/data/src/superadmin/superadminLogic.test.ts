import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcolaKpiPiattaforma,
  calcolaNuovaScadenzaLicenza,
  calcolaStatoLicenza,
  filtraAmministratori,
  validaInvitoAmministratore,
  validaPianoUnico,
  type AmministratoreConCondomini,
} from './superadminLogic.ts';

const MOCK_ADMIN: AmministratoreConCondomini[] = [
  {
    id: 'adm-1',
    email: 'mario.rossi@studio.it',
    nomeCognome: 'Mario Rossi',
    telefono: '3331234567',
    createdAt: '2026-01-10T10:00:00Z',
    licenza: {
      id: 'lic-1',
      pianoId: 'piano-1',
      pianoNome: 'Piano Unico Piattaforma',
      isActive: true,
      dataScadenza: '2027-01-10',
      stato: 'ATTIVA',
    },
    condomini: [
      {
        id: 'cond-1',
        adminId: 'adm-1',
        nome: 'Residenza Parco',
        indirizzo: 'Via Roma 10',
        citta: 'Milano',
        attivo: true,
        numeroPalazzi: 2,
        numeroUnita: 24,
      },
      {
        id: 'cond-2',
        adminId: 'adm-1',
        nome: 'Condominio Sole',
        indirizzo: 'Via Verdi 5',
        citta: 'Monza',
        attivo: false,
        numeroPalazzi: 1,
        numeroUnita: 12,
      },
    ],
  },
  {
    id: 'adm-2',
    email: 'laura.bianchi@studio.it',
    nomeCognome: 'Laura Bianchi',
    telefono: null,
    createdAt: '2026-02-01T10:00:00Z',
    licenza: {
      id: 'lic-2',
      pianoId: 'piano-1',
      pianoNome: 'Piano Unico Piattaforma',
      isActive: false,
      dataScadenza: '2025-12-31',
      stato: 'SCADUTA',
    },
    condomini: [
      {
        id: 'cond-3',
        adminId: 'adm-2',
        nome: 'Palazzo Centrale',
        indirizzo: 'Corso Italia 22',
        citta: 'Torino',
        attivo: true,
        numeroPalazzi: 1,
        numeroUnita: 18,
      },
    ],
  },
];

describe('superadminLogic', () => {
  it('calcolaStatoLicenza distingue attiva, scaduta e assente', () => {
    assert.equal(calcolaStatoLicenza(null, '2026-11-13'), 'ASSENTE');
    assert.equal(calcolaStatoLicenza({ is_active: false, data_scadenza: '2027-01-01' }, '2026-11-13'), 'SCADUTA');
    assert.equal(calcolaStatoLicenza({ is_active: true, data_scadenza: '2026-10-01' }, '2026-11-13'), 'SCADUTA');
    assert.equal(calcolaStatoLicenza({ is_active: true, data_scadenza: '2027-01-01' }, '2026-11-13'), 'ATTIVA');
    assert.equal(calcolaStatoLicenza({ is_active: true, data_scadenza: null }, '2026-11-13'), 'ATTIVA');
  });

  it('calcolaKpiPiattaforma aggrega condomini attivi/sospesi, admin e unità', () => {
    const kpi = calcolaKpiPiattaforma(MOCK_ADMIN);
    assert.equal(kpi.totaleCondomini, 3);
    assert.equal(kpi.condominiAttivi, 2);
    assert.equal(kpi.condominiSospesi, 1);
    assert.equal(kpi.totaleAmministratori, 2);
    assert.equal(kpi.amministratoriLicenzaAttiva, 1);
    assert.equal(kpi.amministratoriLicenzaScaduta, 1);
    assert.equal(kpi.totaleUnita, 54);
  });

  it('filtraAmministratori filtra per query e stato condomini', () => {
    assert.equal(filtraAmministratori(MOCK_ADMIN, '', 'tutti').length, 2);
    assert.equal(filtraAmministratori(MOCK_ADMIN, '', 'sospesi').length, 1);
    assert.equal(filtraAmministratori(MOCK_ADMIN, 'torino', 'tutti').length, 1);
    assert.equal(filtraAmministratori(MOCK_ADMIN, 'mario', 'tutti')[0]?.id, 'adm-1');
  });

  it('validaInvitoAmministratore verifica email e nome', () => {
    assert.ok(validaInvitoAmministratore('non-valida', 'A'));
    assert.equal(validaInvitoAmministratore('nuovo@studio.it', 'Giulia Neri'), null);
  });

  it('validaPianoUnico verifica canone >= 0 e nome', () => {
    assert.ok(validaPianoUnico('-5', 'Ok'));
    assert.equal(validaPianoUnico('29,00', 'Piano Unico Piattaforma'), null);
  });

  it('calcolaNuovaScadenzaLicenza estende da data futura o da oggi', () => {
    const oggi = new Date('2026-11-13T10:00:00Z');
    assert.equal(calcolaNuovaScadenzaLicenza('2027-01-10', 12, oggi), '2028-01-10');
    assert.equal(calcolaNuovaScadenzaLicenza('2025-01-01', 6, oggi), '2027-05-13');
    assert.equal(calcolaNuovaScadenzaLicenza(null, 1, oggi), '2026-12-13');
  });
});
