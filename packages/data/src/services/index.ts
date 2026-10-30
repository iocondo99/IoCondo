import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createAssembleaService } from './assembleaService';
import { createAuthService } from './authService';
import { createBachecaService } from './bachecaService';
import { createCondominiService } from './condominiService';
import { createFornitoreService } from './fornitoreService';
import { createRateService } from './rateService';
import { createServiziService } from './serviziService';
import { createStrutturaService } from './strutturaService';
import { createTicketService } from './ticketService';

/** Compone tutti i service su un client dato: il client lo crea l'app (nessun singleton qui). */
export function createServices(db: TypedSupabaseClient) {
  return {
    auth: createAuthService(db),
    condomini: createCondominiService(db),
    struttura: createStrutturaService(db),
    rate: createRateService(db),
    ticket: createTicketService(db),
    fornitori: createFornitoreService(db),
    bacheca: createBachecaService(db),
    servizi: createServiziService(db),
    assemblee: createAssembleaService(db),
  };
}
export type Services = ReturnType<typeof createServices>;

export * from './assembleaService';
export * from './authService';
export * from './bachecaService';
export * from './condominiService';
export * from './fornitoreService';
export * from './rateService';
export * from './serviziService';
export * from './strutturaService';
export * from './ticketService';
