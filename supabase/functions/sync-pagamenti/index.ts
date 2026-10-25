// POST /functions/v1/sync-pagamenti  (webhook Stripe - UC-01)
// Non usa JWT utente (verify_jwt = false in config.toml): l'autenticita' e' garantita dalla FIRMA Stripe.
// Eventi gestiti: payment_intent.succeeded | payment_intent.payment_failed | charge.refunded
// Idempotente: lavora solo sui pagamenti nello stato atteso (IN_ATTESA / COMPLETATO).
import Stripe from 'npm:stripe@17';
import { corsHeaders, HttpError, json, serve } from '../_shared/http.ts';
import { adminClient, type Db } from '../_shared/auth.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() });
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const round2 = (n: number) => Math.round(n * 100) / 100;
const oggi = () => new Date().toISOString().slice(0, 10);

async function aggiornaRata(db: Db, rataId: string, delta: number) {
  const { data: rata, error } = await db
    .from('rate_dettaglio')
    .select('importo_dovuto, importo_pagato, stato, rata_testata_id')
    .eq('id', rataId)
    .single();
  if (error || !rata) throw new HttpError(500, 'Rata non trovata', error?.message);

  const dovuto = Number(rata.importo_dovuto);
  const pagato = Math.max(0, round2(Number(rata.importo_pagato) + delta));
  const saldata = pagato >= dovuto - 0.005;

  let stato = rata.stato as string;
  if (saldata) stato = 'PAGATO';
  else if (stato === 'PAGATO') {
    // rimborso: la rata torna da pagare (o in ritardo se scaduta)
    const { data: testata } = await db.from('rate_testata').select('data_scadenza').eq('id', rata.rata_testata_id).single();
    stato = testata && testata.data_scadenza < oggi() ? 'RITARDO' : 'DA_PAGARE';
  }

  const { error: uErr } = await db
    .from('rate_dettaglio')
    .update({ importo_pagato: pagato, stato, data_pagamento: saldata ? oggi() : null })
    .eq('id', rataId);
  if (uErr) throw new HttpError(500, 'Errore aggiornamento rata', uErr.message);
  return { stato, importo_pagato: pagato };
}

async function onSucceeded(db: Db, pi: Stripe.PaymentIntent) {
  const importo = round2((pi.amount_received || pi.amount) / 100);
  const { data, error } = await db.rpc('pagamento_completato', {
    p_provider_ref: pi.id,
    p_importo: importo,
  });
  if (error) throw new HttpError(500, 'Errore registrazione pagamento atomico', error.message);
  return data;
}

async function onFailed(db: Db, pi: Stripe.PaymentIntent) {
  const { data } = await db
    .from('pagamenti_rate').update({ stato: 'FALLITO' })
    .eq('provider', 'STRIPE').eq('provider_ref', pi.id).eq('stato', 'IN_ATTESA')
    .select('id');
  return { esito: data?.length ? 'fallito' : 'ignorato' };
}

async function onRefunded(db: Db, charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return { esito: 'ignorato (nessun payment_intent)' };
  const { data: pag } = await db
    .from('pagamenti_rate').update({ stato: 'RIMBORSATO' })
    .eq('provider', 'STRIPE').eq('provider_ref', piId).eq('stato', 'COMPLETATO')
    .select('id, rata_dettaglio_id, importo')
    .maybeSingle();
  if (!pag) return { esito: 'ignorato' };
  return { esito: 'rimborsato', rata: await aggiornaRata(db, pag.rata_dettaglio_id, -Number(pag.importo)) };
}

serve(async (req) => {
  if (!WEBHOOK_SECRET) throw new HttpError(500, 'STRIPE_WEBHOOK_SECRET non configurato');
  const signature = req.headers.get('stripe-signature');
  if (!signature) throw new HttpError(400, 'Firma Stripe mancante');

  // il corpo grezzo e' necessario per verificare la firma
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (e) {
    throw new HttpError(400, `Firma non valida: ${(e as Error).message}`);
  }

  const db = adminClient();
  let result: unknown;
  switch (event.type) {
    case 'payment_intent.succeeded':
      result = await onSucceeded(db, event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      result = await onFailed(db, event.data.object as Stripe.PaymentIntent);
      break;
    case 'charge.refunded':
      result = await onRefunded(db, event.data.object as Stripe.Charge);
      break;
    default:
      return json({ received: true, ignored: event.type });
  }
  return json({ received: true, type: event.type, result });
});

// (corsHeaders importato per uniformita' con le altre funzioni: i webhook Stripe non usano CORS)
void corsHeaders;
