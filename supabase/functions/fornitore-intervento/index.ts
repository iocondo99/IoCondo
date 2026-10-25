// POST /functions/v1/fornitore-intervento (UC-08 Magic link fornitore frictionless)
// Accesso senza login con Magic Link (token).
// verify_jwt = false in config.toml
import { HttpError, json, serve } from '../_shared/http.ts';
import { adminClient } from '../_shared/auth.ts';

interface ActionInput {
  token: string;
  azione: 'get' | 'chiudi';
  importo_consuntivo?: number;
  note_fornitore?: string;
}

serve(async (req) => {
  const body = (await req.json().catch(() => null)) as ActionInput | null;
  if (!body || !body.token || typeof body.token !== 'string') {
    throw new HttpError(400, 'Token obbligatorio');
  }

  const db = adminClient();

  // 1. Valida token
  const { data: tokenRow, error: tErr } = await db
    .from('fornitori_tokens')
    .select('token, ticket_intervento_id, data_scadenza, used_at')
    .eq('token', body.token)
    .maybeSingle();

  if (tErr || !tokenRow) throw new HttpError(404, 'Magic link non trovato o non valido');
  if (tokenRow.used_at) throw new HttpError(410, 'Questo link e\' gia\' stato utilizzato');
  if (new Date(tokenRow.data_scadenza) < new Date()) throw new HttpError(410, 'Questo link e\' scaduto');

  // 2. Recupera l'intervento collegato
  const { data: intervento, error: iErr } = await db
    .from('ticket_interventi')
    .select('id, ticket_id, data_prevista, importo_consuntivo, note_fornitore')
    .eq('id', tokenRow.ticket_intervento_id)
    .single();

  if (iErr || !intervento) throw new HttpError(404, 'Intervento non trovato');

  // 3. Recupera info ticket
  const { data: ticket, error: tkErr } = await db
    .from('ticket_testata')
    .select('id, titolo, descrizione, is_area_comune, priorita, stato, condominio_id')
    .eq('id', intervento.ticket_id)
    .single();

  if (tkErr || !ticket) throw new HttpError(404, 'Ticket non trovato');

  const { data: cond } = await db
    .from('condomini')
    .select('nome, indirizzo, citta')
    .eq('id', ticket.condominio_id)
    .single();

  if (body.azione === 'get' || !body.azione) {
    return json({
      ticket: {
        id: ticket.id,
        titolo: ticket.titolo,
        descrizione: ticket.descrizione,
        stato: ticket.stato,
        priorita: ticket.priorita,
        is_area_comune: ticket.is_area_comune,
        condominio: cond ? `${cond.nome} - ${cond.indirizzo}, ${cond.citta}` : '',
      },
      intervento: {
        id: intervento.id,
        data_prevista: intervento.data_prevista,
      },
    });
  }

  if (body.azione === 'chiudi') {
    const importo = typeof body.importo_consuntivo === 'number' && body.importo_consuntivo >= 0 ? body.importo_consuntivo : null;
    const note = body.note_fornitore?.trim() || null;

    // Aggiorna l'intervento
    const { error: updIErr } = await db
      .from('ticket_interventi')
      .update({
        importo_consuntivo: importo,
        note_fornitore: note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intervento.id);

    if (updIErr) throw new HttpError(500, 'Errore aggiornamento intervento', updIErr.message);

    // Marca il ticket come RISOLTO
    const { error: updTkErr } = await db
      .from('ticket_testata')
      .update({
        stato: 'RISOLTO',
        closed_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (updTkErr) throw new HttpError(500, 'Errore chiusura ticket', updTkErr.message);

    // Invalida il token
    await db
      .from('fornitori_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', body.token);

    return json({
      ok: true,
      messaggio: 'Intervento completato e ticket chiuso con successo',
    });
  }

  throw new HttpError(400, 'Azione non supportata');
});
