import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcolaProssimoTentativoIso,
  calcolaRiepilogoCoda,
  costruisciIdempotencyKey,
  costruisciMittenteAmministratore,
  filtraCodaEmail,
  generaTemplateBollettinoEmesso,
  generaTemplateComunicazioneImportante,
  generaTemplateConvocazioneAssemblea,
  isEmailValida,
} from './codaEmailLogic.ts';

test('costruisciMittenteAmministratore: nome mostrato (IoCondo) e Reply-To conformi', () => {
  const m = costruisciMittenteAmministratore({
    nomeCognome: 'Mario Rossi',
    email: 'Mario.Rossi@Studio.IT ',
  });
  assert.equal(m.nomeVisualizzato, 'Mario Rossi (IoCondo)');
  assert.equal(m.fromEmail, 'Mario Rossi (IoCondo)');
  assert.equal(m.replyToEmail, 'mario.rossi@studio.it');

  const fallback = costruisciMittenteAmministratore({
    nomeCognome: null,
    email: null,
  });
  assert.equal(fallback.fromEmail, 'Amministratore Condominio');
  assert.equal(fallback.replyToEmail, null);

  const injectionSafe = costruisciMittenteAmministratore({
    nomeCognome: 'Mario\r\n<script>Rossi',
    email: 'non-valida',
  });
  assert.ok(!injectionSafe.fromEmail.includes('\n'));
  assert.ok(!injectionSafe.fromEmail.includes('\r'));
  assert.ok(!injectionSafe.fromEmail.includes('<'));
  assert.equal(injectionSafe.replyToEmail, null);
});

test('generaTemplateBollettinoEmesso: include dati, escape HTML e nota footer', () => {
  const mittente = costruisciMittenteAmministratore({
    nomeCognome: 'Laura Verdi',
    email: 'laura.verdi@studio.it',
  });
  const res = generaTemplateBollettinoEmesso(
    {
      condominioNome: 'Condominio Parco',
      destinatarioNome: 'Luca Bianchi',
      numeroProgressivo: 12,
      anno: 2026,
      totaleCentesimi: 24550,
      dataScadenza: '2026-12-15',
      causale: 'Rata 3 <Ordinaria>',
      ibanAccredito: 'IT60X0542811101000000123456',
      unitaLabel: 'Palazzo A - Int. 4',
      righeDescrizione: ['Quota gestione ordinaria'],
    },
    mittente,
  );
  assert.match(res.oggetto, /12\/2026/);
  assert.match(res.oggetto, /245,50/);
  assert.match(res.htmlBody, /15\/12\/2026/);
  assert.match(res.htmlBody, /Rata 3 &lt;Ordinaria&gt;/);
  assert.match(res.htmlBody, /IT60X0542811101000000123456/);
  assert.match(
    res.textBody,
    /Inviato per conto di Laura Verdi \(IoCondo\)\. Per rispondere utilizza il tasto Rispondi \(destinatario: laura\.verdi@studio\.it\)\./,
  );
});

test('generaTemplateConvocazioneAssemblea: include convocazioni, luogo e ODG', () => {
  const mittente = costruisciMittenteAmministratore({
    nomeCognome: 'Mario Rossi',
    email: 'mario@rossi.it',
  });
  const res = generaTemplateConvocazioneAssemblea(
    {
      condominioNome: 'Condominio Sole',
      tipo: 'ORDINARIA',
      dataPrimaConvocazione: '2026-11-20T08:00:00Z',
      dataSecondaConvocazione: '2026-11-21T18:30:00Z',
      dataPrincipale: '2026-11-21T18:30:00Z',
      luogo: 'Sala condominiale',
      puntiOdg: [
        { ordine: 1, titolo: 'Approvazione rendiconto', descrizione: 'Esercizio 2025' },
        { ordine: 2, titolo: 'Varie ed eventuali' },
      ],
    },
    mittente,
  );
  assert.match(res.oggetto, /Convocazione Assemblea Ordinaria/);
  assert.match(res.htmlBody, /Sala condominiale/);
  assert.match(res.htmlBody, /Approvazione rendiconto/);
  assert.match(res.textBody, /1\. Approvazione rendiconto - Esercizio 2025/);
  assert.match(res.textBody, /mario@rossi\.it/);
});

test('generaTemplateComunicazioneImportante: include ambito, titolo e corpo', () => {
  const mittente = costruisciMittenteAmministratore({
    nomeCognome: 'Mario Rossi',
    email: 'mario@rossi.it',
  });
  const res = generaTemplateComunicazioneImportante(
    {
      condominioNome: 'Condominio Sole',
      titolo: 'Chiusura acqua programmata',
      corpo: 'Domani dalle 09:00 alle 12:00.',
      ambitoLabel: 'Palazzo A',
    },
    mittente,
  );
  assert.equal(res.oggetto, '[Importante] Chiusura acqua programmata - Condominio Sole');
  assert.match(res.htmlBody, /Palazzo A/);
  assert.match(res.textBody, /Domani dalle 09:00 alle 12:00\./);
});

test('retry/backoff esponenziale, idempotenza e riepilogo/filtri coda', () => {
  const base = new Date('2026-11-15T10:00:00.000Z');
  assert.equal(calcolaProssimoTentativoIso(1, base), '2026-11-15T10:02:00.000Z');
  assert.equal(calcolaProssimoTentativoIso(2, base), '2026-11-15T10:06:00.000Z');
  assert.equal(calcolaProssimoTentativoIso(3, base), '2026-11-15T10:18:00.000Z');
  assert.equal(calcolaProssimoTentativoIso(5, base), '2026-11-15T12:00:00.000Z');

  assert.equal(
    costruisciIdempotencyKey('BOLLETTINO_EMESSO', 'abc-123', ' Mario@Test.IT '),
    'BOLLETTINO_EMESSO:abc-123:mario@test.it',
  );
  assert.equal(isEmailValida('a@b.it'), true);
  assert.equal(isEmailValida('non-valida'), false);

  const righe = [
    { stato: 'PENDING' as const, tipo_evento: 'BOLLETTINO_EMESSO' as const, destinatario_email: 'a@b.it', destinatario_nome: 'Anna', oggetto: 'Bollettino 1' },
    { stato: 'PROCESSING' as const, tipo_evento: 'CONVOCAZIONE_ASSEMBLEA' as const, destinatario_email: 'c@d.it', destinatario_nome: 'Carlo', oggetto: 'Assemblea' },
    { stato: 'SENT' as const, tipo_evento: 'COMUNICAZIONE_IMPORTANTE' as const, destinatario_email: 'e@f.it', destinatario_nome: 'Elena', oggetto: 'Avviso acqua' },
    { stato: 'FAILED' as const, tipo_evento: 'BOLLETTINO_EMESSO' as const, destinatario_email: 'g@h.it', destinatario_nome: 'Gianni', oggetto: 'Bollettino 2' },
  ];
  assert.deepEqual(calcolaRiepilogoCoda(righe), { totali: 4, inAttesa: 2, inviate: 1, fallite: 1 });
  assert.equal(filtraCodaEmail(righe, { stato: 'IN_ATTESA' }).length, 2);
  assert.equal(filtraCodaEmail(righe, { tipoEvento: 'BOLLETTINO_EMESSO' }).length, 2);
  assert.equal(filtraCodaEmail(righe, { search: 'acqua' }).length, 1);
});
