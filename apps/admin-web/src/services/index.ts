import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { supabase } from '@/lib/supabase';
import { createAuthService } from './authService';
import { createBachecaService } from './bachecaService';
import { createCondominiService } from './condominiService';
import { createFornitoreService } from './fornitoreService';
import { createRateService } from './rateService';
import { createStrutturaService } from './strutturaService';
import { createTicketService } from './ticketService';

/** Compone tutti i service su un client dato (utile per i Server Components con client server). */
export function createServices(db: TypedSupabaseClient) {
  return {
    auth: createAuthService(db),
    condomini: createCondominiService(db),
    struttura: createStrutturaService(db),
    rate: createRateService(db),
    ticket: createTicketService(db),
    fornitori: createFornitoreService(db),
    bacheca: createBachecaService(db),
  };
}

/** Istanza pronta all'uso nei client components: `import { services } from '@/services'`. */
export const services = createServices(supabase);

export * from './authService';
export * from './bachecaService';
export * from './condominiService';
export * from './fornitoreService';
export * from './rateService';
export * from './strutturaService';
export * from './ticketService';
