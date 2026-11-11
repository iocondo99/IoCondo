import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validaNuovaAssemblea,
  calcolaQuorumCostitutivo,
  calcolaQuorumDeliberativo,
  verificaCumuloDeleghe,
} from './assembleeAdminLogic.ts';
import { isEmailValida } from './invitiAdminLogic.ts';

describe('Admin Regression & Quality Audit Suite', () => {
  describe('Assemblee: Validazione date convocazioni (art. 66 disp. att. c.c.)', () => {
    it('rileva campi vuoti obbligatori per 1ª e 2ª convocazione', () => {
      const res = validaNuovaAssemblea({
        tipo: 'ORDINARIA',
        dataPrimaConvocazione: '',
        dataSecondaConvocazione: '',
        modalita: 'PRESENZA',
        luogo: 'Sala Condominiale',
      });
      assert.equal(res.valido, false);
      assert.ok(res.errori.dataPrimaConvocazione);
      assert.ok(res.errori.dataSecondaConvocazione);
    });

    it('accetta convocazioni valide con 2ª convocazione successiva alla 1ª', () => {
      const res = validaNuovaAssemblea({
        tipo: 'ORDINARIA',
        dataPrimaConvocazione: '2026-11-20T08:00',
        dataSecondaConvocazione: '2026-11-21T18:30',
        modalita: 'PRESENZA',
        luogo: 'Sala Condominiale',
      });
      assert.equal(res.valido, true);
      assert.equal(Object.keys(res.errori).length, 0);
    });

    it('blocca e segnala errore se la 2ª convocazione è antecedente o uguale alla 1ª (art. 66 disp. att. c.c.)', () => {
      const res = validaNuovaAssemblea({
        tipo: 'ORDINARIA',
        dataPrimaConvocazione: '2026-11-20T18:00',
        dataSecondaConvocazione: '2026-11-19T08:00', // antecedente!
        modalita: 'PRESENZA',
        luogo: 'Sala Condominiale',
      });
      assert.equal(res.valido, false);
      assert.equal(
        res.errori.dataSecondaConvocazione,
        'La 2ª convocazione deve essere successiva alla 1ª convocazione.',
      );
    });
  });

  describe('Assemblee: Calcolo Quorum Costitutivo e Deliberativo (art. 1136 c.c.)', () => {
    it('calcola quorum 2ª convocazione: minimo 1/3 delle teste e 333.33 millesimi', () => {
      const quorum = calcolaQuorumCostitutivo({
        testeTotali: 6,
        totaleMillesimi: 1000,
        convocazione: 'SECONDA',
        testePresenti: 2,
        millesimiPresenti: 580,
      });
      assert.equal(quorum.valido, true);
      assert.equal(quorum.testeRichieste, 2); // 6 / 3 = 2
      assert.equal(quorum.millesimiRichiesti, 333.33);
    });

    it('rifiuta delibera se non raggiunge doppia maggioranza teste e millesimi', () => {
      const esito = calcolaQuorumDeliberativo({
        tipoAssemblea: 'ORDINARIA',
        convocazione: 'SECONDA',
        unitaList: [
          {
            id: 'u1',
            interno: '1',
            scala: 'A',
            palazzoNome: 'Palazzo A',
            valoreMillesimale: 280,
            proprietarioNome: 'Utente 1',
          },
          {
            id: 'u2',
            interno: '2',
            scala: 'A',
            palazzoNome: 'Palazzo A',
            valoreMillesimale: 300,
            proprietarioNome: 'Utente 2',
          },
        ],
        presenzeMap: {
          u1: { unitaId: 'u1', modalita: 'PRESENZA' },
          u2: { unitaId: 'u2', modalita: 'PRESENZA' },
        },
        votiMap: {
          u1: 'FAVOREVOLE',
          u2: 'CONTRARIO',
        },
      });
      assert.equal(esito.approvata, false);
      assert.equal(esito.esito, 'RESPINTA');
    });

    it('approva delibera se raggiunge maggioranza intervenuti e millesimi minimi', () => {
      const esito = calcolaQuorumDeliberativo({
        tipoAssemblea: 'ORDINARIA',
        convocazione: 'SECONDA',
        unitaList: [
          {
            id: 'u1',
            interno: '1',
            scala: 'A',
            palazzoNome: 'Palazzo A',
            valoreMillesimale: 280,
            proprietarioNome: 'Utente 1',
          },
          {
            id: 'u2',
            interno: '2',
            scala: 'A',
            palazzoNome: 'Palazzo A',
            valoreMillesimale: 300,
            proprietarioNome: 'Utente 2',
          },
        ],
        presenzeMap: {
          u1: { unitaId: 'u1', modalita: 'PRESENZA' },
          u2: { unitaId: 'u2', modalita: 'PRESENZA' },
        },
        votiMap: {
          u1: 'FAVOREVOLE',
          u2: 'FAVOREVOLE',
        },
      });
      assert.equal(esito.approvata, true);
      assert.equal(esito.esito, 'APPROVATA');
    });
  });

  describe('Assemblee: Controllo Deleghe ex art. 67 disp. att. c.c.', () => {
    it('applica limite se condomini > 20 e rileva violazione oltre 1/5 dei condòmini', () => {
      // 25 unita con proprietari diversi
      const unita = Array.from({ length: 25 }, (_, i) => ({
        id: `u_${i + 1}`,
        interno: `${i + 1}`,
        scala: 'A',
        palazzoNome: 'Palazzo A',
        valoreMillesimale: 40,
        proprietarioId: `prop_${i + 1}`,
        proprietarioNome: `Proprietario ${i + 1}`,
      }));

      // Delegato riceve 6 deleghe (> 25 / 5 = 5)
      const presenze: Record<string, any> = {};
      for (let i = 1; i <= 6; i++) {
        presenze[`u_${i}`] = {
          unitaId: `u_${i}`,
          modalita: 'DELEGA',
          delegatoUtenteId: 'prop_25',
          delegatoNome: 'Proprietario 25',
        };
      }

      const res = verificaCumuloDeleghe(unita, presenze, 1000);
      assert.equal(res.limiteApplicabile, true);
      assert.equal(res.maxDelegheConsentite, 5);
      assert.equal(res.haViolazioni, true);
    });
  });

  describe('Inviti: Validazione RFC Email e ruoli', () => {
    it('rifiuta indirizzi email privi di dominio o malformati', () => {
      assert.equal(isEmailValida('test@'), false);
      assert.equal(isEmailValida('test @example.com'), false);
      assert.equal(isEmailValida('admin'), false);
      assert.equal(isEmailValida('test@localhost'), false);
    });

    it('accetta indirizzi email conformi RFC', () => {
      assert.equal(isEmailValida('condomino.test@example.com'), true);
      assert.equal(isEmailValida('admin+condo@pec.it'), true);
    });
  });
});
