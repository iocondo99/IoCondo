import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeStatoAssembleaAdmin,
  calcolaQuorumCostitutivo,
  calcolaQuorumDeliberativo,
  esportaTestoVerbalePunto,
  filtraAssembleeAdmin,
  generaTabellaNominalePunto,
  riepilogoAssembleeAdmin,
  validaNuovaAssemblea,
  verificaCumuloDeleghe,
  type AssembleaAdminView,
  type PresenzaUnitaView,
  type PuntoOdgAdminView,
  type UnitaAssembleaView,
  type VotoSceltaAdmin,
} from './assembleeAdminLogic.ts';

describe('assembleeAdminLogic', () => {
  describe('Quorum Costitutivo ex art. 1136 c.c.', () => {
    it('in 1ª convocazione richiede maggioranza teste e 2/3 millesimi', () => {
      // 10 partecipanti totali -> maggioranza è 6 teste
      // 1000 millesimi totali -> 2/3 è 666.67
      const ok = calcolaQuorumCostitutivo({
        convocazione: 'PRIMA',
        testePresenti: 6,
        testeTotali: 10,
        millesimiPresenti: 670,
        totaleMillesimi: 1000,
      });
      assert.equal(ok.valido, true);
      assert.equal(ok.testeSoddisfatte, true);
      assert.equal(ok.millesimiSoddisfatti, true);
      assert.equal(ok.badgeStatus, 'success');
      assert.match(ok.badgeLabel, /costituita/i);

      // Mancano le teste (5 su 10 = metà, non maggioranza)
      const noTeste = calcolaQuorumCostitutivo({
        convocazione: 'PRIMA',
        testePresenti: 5,
        testeTotali: 10,
        millesimiPresenti: 700,
        totaleMillesimi: 1000,
      });
      assert.equal(noTeste.valido, false);
      assert.equal(noTeste.testeSoddisfatte, false);
      assert.equal(noTeste.millesimiSoddisfatti, true);
      assert.equal(noTeste.badgeStatus, 'error');

      // Mancano i millesimi (6 teste ma solo 600 millesimi)
      const noMillesimi = calcolaQuorumCostitutivo({
        convocazione: 'PRIMA',
        testePresenti: 6,
        testeTotali: 10,
        millesimiPresenti: 600,
        totaleMillesimi: 1000,
      });
      assert.equal(noMillesimi.valido, false);
      assert.equal(noMillesimi.testeSoddisfatte, true);
      assert.equal(noMillesimi.millesimiSoddisfatti, false);
      assert.equal(noMillesimi.badgeStatus, 'error');
    });

    it('in 2ª convocazione richiede almeno 1/3 teste e 1/3 millesimi', () => {
      // 12 condòmini -> 1/3 è 4 teste; 1000 millesimi -> 1/3 è 333.33 millesimi
      const ok = calcolaQuorumCostitutivo({
        convocazione: 'SECONDA',
        testePresenti: 4,
        testeTotali: 12,
        millesimiPresenti: 334,
        totaleMillesimi: 1000,
      });
      assert.equal(ok.valido, true);
      assert.equal(ok.badgeStatus, 'success');

      // 3 teste su 12 = 1/4 (sotto 1/3)
      const noTeste = calcolaQuorumCostitutivo({
        convocazione: 'SECONDA',
        testePresenti: 3,
        testeTotali: 12,
        millesimiPresenti: 400,
        totaleMillesimi: 1000,
      });
      assert.equal(noTeste.valido, false);
      assert.equal(noTeste.testeSoddisfatte, false);
    });

    it('identifica la seduta deserta se zero presenze', () => {
      const deserta = calcolaQuorumCostitutivo({
        convocazione: 'SECONDA',
        testePresenti: 0,
        testeTotali: 10,
        millesimiPresenti: 0,
      });
      assert.equal(deserta.valido, false);
      assert.equal(deserta.badgeLabel, 'Seduta deserta');
      assert.equal(deserta.badgeStatus, 'error');
    });
  });

  describe('Verifica Cumulo Deleghe ex art. 67 disp. att. c.c.', () => {
    it('non applica il limite di 1/5 se i condòmini sono 20 o meno', () => {
      const unitaList: UnitaAssembleaView[] = Array.from({ length: 15 }, (_, i) => ({
        id: `u_${i + 1}`,
        interno: `${i + 1}`,
        valoreMillesimale: 66.6,
        proprietarioId: `condomino_${i + 1}`,
        proprietarioNome: `Condòmino ${i + 1}`,
      }));

      // Un condòmino riceve 5 deleghe (un terzo dei condòmini)
      const presenzeMap: Record<string, PresenzaUnitaView> = {
        u_1: { unitaId: 'u_1', modalita: 'PRESENZA' },
        u_2: { unitaId: 'u_2', modalita: 'DELEGA', delegatoUtenteId: 'condomino_1', delegatoNome: 'Condòmino 1' },
        u_3: { unitaId: 'u_3', modalita: 'DELEGA', delegatoUtenteId: 'condomino_1', delegatoNome: 'Condòmino 1' },
        u_4: { unitaId: 'u_4', modalita: 'DELEGA', delegatoUtenteId: 'condomino_1', delegatoNome: 'Condòmino 1' },
        u_5: { unitaId: 'u_5', modalita: 'DELEGA', delegatoUtenteId: 'condomino_1', delegatoNome: 'Condòmino 1' },
      };

      const res = verificaCumuloDeleghe(unitaList, presenzeMap);
      assert.equal(res.limiteApplicabile, false);
      assert.equal(res.haViolazioni, false);
      assert.match(res.messaggio, /≤ 20/);
    });

    it('rileva violazione se condòmini > 20 e delegato supera 1/5 partecipanti o 1/5 valore', () => {
      // 25 condòmini -> 1/5 è 5 deleghe max e 200 millesimi max
      const unitaList: UnitaAssembleaView[] = Array.from({ length: 25 }, (_, i) => ({
        id: `u_${i + 1}`,
        interno: `${i + 1}`,
        valoreMillesimale: 40,
        proprietarioId: `condomino_${i + 1}`,
        proprietarioNome: `Condòmino ${i + 1}`,
      }));

      // condomino_1 ha 6 deleghe (supera max 5) e 240 millesimi (supera 200 ‰)
      const presenzeMap: Record<string, PresenzaUnitaView> = {
        u_1: { unitaId: 'u_1', modalita: 'PRESENZA' },
      };
      for (let i = 2; i <= 7; i++) {
        presenzeMap[`u_${i}`] = {
          unitaId: `u_${i}`,
          modalita: 'DELEGA',
          delegatoUtenteId: 'condomino_1',
          delegatoNome: 'Condòmino 1',
        };
      }

      const res = verificaCumuloDeleghe(unitaList, presenzeMap);
      assert.equal(res.limiteApplicabile, true);
      assert.equal(res.maxDelegheConsentite, 5);
      assert.equal(res.maxMillesimiConsentiti, 200);
      assert.equal(res.haViolazioni, true);
      assert.equal(res.delegati.length, 1);
      assert.equal(res.delegati[0]!.superaLimite, true);
      assert.match(res.delegati[0]!.motivoViolazione || '', /troppe deleghe/);
    });
  });

  describe('Quorum Deliberativo ex art. 1136 c.c.', () => {
    const unitaList: UnitaAssembleaView[] = [
      { id: 'u_1', interno: '1', valoreMillesimale: 150, proprietarioId: 'c_1', proprietarioNome: 'Mario Rossi' },
      { id: 'u_2', interno: '2', valoreMillesimale: 180, proprietarioId: 'c_2', proprietarioNome: 'Luigi Bianchi' },
      { id: 'u_3', interno: '3', valoreMillesimale: 120, proprietarioId: 'c_3', proprietarioNome: 'Anna Verdi' },
      { id: 'u_4', interno: '4', valoreMillesimale: 200, proprietarioId: 'c_4', proprietarioNome: 'Paolo Neri' },
    ];

    const presenzeMap: Record<string, PresenzaUnitaView> = {
      u_1: { unitaId: 'u_1', modalita: 'PRESENZA' },
      u_2: { unitaId: 'u_2', modalita: 'ONLINE' },
      u_3: { unitaId: 'u_3', modalita: 'DELEGA', delegatoUtenteId: 'c_1', delegatoNome: 'Mario Rossi' },
      u_4: { unitaId: 'u_4', modalita: 'ASSENTE' },
    };

    it('approva delibera ordinaria in 2ª conv con maggioranza intervenuti e >= 333.33 millesimi', () => {
      // 3 unità presenti (u_1, u_2, u_3)
      // Favorevoli: u_1 (150 mm) e u_2 (180 mm) = 2 teste, 330 mm? No 150+180=330 mm < 333.33 mm
      // Facciamo votare favorevole u_1 (150 mm) e u_3 (120 mm) e contrario u_2 (180 mm) -> 270 mm (respinta per mm)
      // Se invece u_1 (150) e u_2 (180) votano fav e u_3 (120) astenuto -> 330 mm (sotto 333.33)
      // Per approvare serve >= 333.33 mm: u_1 (150) + u_2 (180) + u_3 (120) = 450 mm se u_1 e u_2 e u_3 votano fav
      // Oppure assegniamo millesimi sufficienti:
      const votiFav: Record<string, VotoSceltaAdmin> = {
        u_1: 'FAVOREVOLE', // 150
        u_2: 'FAVOREVOLE', // 180
        u_3: 'ASTENUTO',   // 120
      };
      // 150 + 180 = 330 millesimi. Con 330 < 333.33 viene respinta per millesimi!
      const resResp = calcolaQuorumDeliberativo({
        tipoAssemblea: 'ORDINARIA',
        convocazione: 'SECONDA',
        unitaList,
        presenzeMap,
        votiMap: votiFav,
      });
      assert.equal(resResp.approvata, false);
      assert.equal(resResp.esito, 'RESPINTA');
      assert.equal(resResp.testeSoddisfatte, true); // 2 teste fav su 3 intervenute (> 1.5)
      assert.equal(resResp.millesimiSoddisfatti, false); // 330 < 333.33

      // Se anche u_3 vota favorevole: 150+180+120 = 450 mm >= 333.33 mm e 3 teste fav su 3
      const votiTuttiFav: Record<string, VotoSceltaAdmin> = {
        u_1: 'FAVOREVOLE',
        u_2: 'FAVOREVOLE',
        u_3: 'FAVOREVOLE',
      };
      const resAppr = calcolaQuorumDeliberativo({
        tipoAssemblea: 'ORDINARIA',
        convocazione: 'SECONDA',
        unitaList,
        presenzeMap,
        votiMap: votiTuttiFav,
      });
      assert.equal(resAppr.approvata, true);
      assert.equal(resAppr.esito, 'APPROVATA');
      assert.equal(resAppr.badgeStatus, 'success');
    });

    it('respinge delibera straordinaria se non raggiunge 500 millesimi', () => {
      const voti: Record<string, VotoSceltaAdmin> = {
        u_1: 'FAVOREVOLE', // 150
        u_2: 'FAVOREVOLE', // 180
        u_3: 'FAVOREVOLE', // 120 -> tot 450 mm (richiesti 500 mm per straordinaria)
      };
      const res = calcolaQuorumDeliberativo({
        tipoAssemblea: 'STRAORDINARIA',
        convocazione: 'SECONDA',
        unitaList,
        presenzeMap,
        votiMap: voti,
      });
      assert.equal(res.approvata, false);
      assert.equal(res.millesimiRichiesti, 500);
      assert.equal(res.millesimiSoddisfatti, false);
      assert.equal(res.esito, 'RESPINTA');
    });
  });

  describe('Tabella nominale e redazione verbale', () => {
    it('genera correttamente le righe nominali per ciascuna unità', () => {
      const unitaList: UnitaAssembleaView[] = [
        { id: 'u_1', interno: '1', valoreMillesimale: 200, proprietarioNome: 'Marco Neri' },
        { id: 'u_2', interno: '2', valoreMillesimale: 300, proprietarioNome: 'Sara Rossi' },
      ];
      const presenzeMap: Record<string, PresenzaUnitaView> = {
        u_1: { unitaId: 'u_1', modalita: 'PRESENZA' },
        u_2: { unitaId: 'u_2', modalita: 'DELEGA', delegatoNome: 'Marco Neri' },
      };
      const votiMap: Record<string, VotoSceltaAdmin> = {
        u_1: 'FAVOREVOLE',
        u_2: 'FAVOREVOLE',
      };

      const righe = generaTabellaNominalePunto(unitaList, presenzeMap, votiMap);
      assert.equal(righe.length, 2);
      assert.equal(righe[0]!.votoEspresso, 'FAVOREVOLE');
      assert.equal(righe[1]!.delegato, 'Marco Neri');
      assert.equal(righe[1]!.votoEspresso, 'FAVOREVOLE');

      const punto: PuntoOdgAdminView = {
        id: 'p_1',
        assembleaId: 'a_1',
        ordine: 1,
        titoloPunto: 'Riparazione tetto',
        descrizione: 'Approvazione preventivo Ditta Alfa',
        votazioneAperta: false,
      };

      const esito = calcolaQuorumDeliberativo({
        tipoAssemblea: 'ORDINARIA',
        convocazione: 'SECONDA',
        unitaList,
        presenzeMap,
        votiMap,
      });

      const testo = esportaTestoVerbalePunto('Assemblea Ordinaria 2026', punto, esito, righe);
      assert.match(testo, /VERBALE DELIBERAZIONE - PUNTO N\. 1/);
      assert.match(testo, /ESITO VOTAZIONE: APPROVATA/);
      assert.match(testo, /Int\. 1/);
      assert.match(testo, /Int\. 2/);
      assert.match(testo, /Marco Neri/);
    });
  });

  describe('StatCard, filtri e validazione', () => {
    it('calcola il riepilogo per le 3 StatCard dell’amministratore', () => {
      const assemblee: AssembleaAdminView[] = [
        {
          id: 'a_1',
          condominioId: 'c_1',
          tabellaMillesimaleId: null,
          data: '2026-11-20T18:00:00Z',
          luogo: 'Sala',
          linkMeet: null,
          verbaleUrl: null,
          stato: 'CONVOCATA',
          tipo: 'ORDINARIA',
          modalita: 'PRESENZA',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
          totalePuntiOdg: 2,
          votazioniAperte: 0,
        },
        {
          id: 'a_2',
          condominioId: 'c_1',
          tabellaMillesimaleId: null,
          data: '2026-11-04T18:00:00Z',
          luogo: 'Sala',
          linkMeet: null,
          verbaleUrl: null,
          stato: 'IN_CORSO',
          tipo: 'STRAORDINARIA',
          modalita: 'IBRIDA',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
          puntiOdg: [
            { id: 'p_1', assembleaId: 'a_2', ordine: 1, titoloPunto: 'P1', votazioneAperta: true },
            { id: 'p_2', assembleaId: 'a_2', ordine: 2, titoloPunto: 'P2', votazioneAperta: true },
          ],
          totalePuntiOdg: 2,
          votazioniAperte: 2,
        },
        {
          id: 'a_3',
          condominioId: 'c_1',
          tabellaMillesimaleId: null,
          data: '2026-06-10T18:00:00Z',
          luogo: 'Studio',
          linkMeet: null,
          verbaleUrl: 'path/to/verbale.pdf',
          stato: 'CONCLUSA',
          tipo: 'ORDINARIA',
          modalita: 'PRESENZA',
          createdAt: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
          totalePuntiOdg: 1,
          votazioniAperte: 0,
        },
      ];

      const r = riepilogoAssembleeAdmin(assemblee, 2026);
      assert.equal(r.totaleAnno, 3);
      assert.equal(r.votazioniAperte, 2);
      assert.equal(r.totaleConcluse, 1);
      assert.ok(r.prossimaAssemblea);
    });

    it('filtra per stato e ricerca', () => {
      const assemblee: AssembleaAdminView[] = [
        {
          id: 'a_1',
          condominioId: 'c_1',
          tabellaMillesimaleId: null,
          data: '2026-11-20T18:00:00Z',
          luogo: 'Sala A',
          linkMeet: null,
          verbaleUrl: null,
          stato: 'CONVOCATA',
          tipo: 'ORDINARIA',
          modalita: 'PRESENZA',
          createdAt: '',
          updatedAt: '',
          totalePuntiOdg: 1,
          votazioniAperte: 0,
        },
        {
          id: 'a_2',
          condominioId: 'c_1',
          tabellaMillesimaleId: null,
          data: '2026-11-22T18:00:00Z',
          luogo: 'Sala B',
          linkMeet: null,
          verbaleUrl: null,
          stato: 'IN_CORSO',
          tipo: 'STRAORDINARIA',
          modalita: 'PRESENZA',
          createdAt: '',
          updatedAt: '',
          totalePuntiOdg: 1,
          votazioniAperte: 1,
        },
      ];

      const conv = filtraAssembleeAdmin(assemblee, { stato: 'convocate', ricerca: '' });
      assert.equal(conv.length, 1);
      assert.equal(conv[0]!.id, 'a_1');

      const cerca = filtraAssembleeAdmin(assemblee, { stato: 'tutte', ricerca: 'straordinaria' });
      assert.equal(cerca.length, 1);
      assert.equal(cerca[0]!.id, 'a_2');
    });

    it('valida la creazione di una nuova assemblea', () => {
      const err = validaNuovaAssemblea({
        tipo: 'ORDINARIA',
        dataPrimaConvocazione: '',
        dataSecondaConvocazione: '',
        modalita: 'PRESENZA',
      });
      assert.equal(err.valido, false);
      assert.ok(err.errori.dataPrimaConvocazione);
      assert.ok(err.errori.dataSecondaConvocazione);

      const ok = validaNuovaAssemblea({
        tipo: 'ORDINARIA',
        dataPrimaConvocazione: '2026-12-01T18:00',
        dataSecondaConvocazione: '2026-12-02T18:00',
        modalita: 'PRESENZA',
        luogo: 'Sala Civica',
      });
      assert.equal(ok.valido, true);
    });

    it('badgeStatoAssembleaAdmin restituisce etichette e status corretti', () => {
      assert.deepEqual(badgeStatoAssembleaAdmin('CONVOCATA'), { label: 'Convocata', status: 'info' });
      assert.deepEqual(badgeStatoAssembleaAdmin('IN_CORSO'), { label: 'In corso', status: 'warning' });
      assert.deepEqual(badgeStatoAssembleaAdmin('CONCLUSA'), { label: 'Conclusa', status: 'success' });
      assert.deepEqual(badgeStatoAssembleaAdmin('BOZZA'), { label: 'Bozza', status: 'neutral' });
    });
  });
});
