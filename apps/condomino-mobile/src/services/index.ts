import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { supabase } from '../lib/supabase';
import { createAssembleaService } from './assembleaService';
import { createAuthService } from './authService';
import { createBachecaService } from './bachecaService';
import { createCondominiService } from './condominiService';
import { createRateService } from './rateService';
import { createServiziService } from './serviziService';
import { createTicketService } from './ticketService';

export function createServices(db: TypedSupabaseClient) {
  return {
    auth: createAuthService(db),
    condomini: createCondominiService(db),
    rate: createRateService(db),
    ticket: createTicketService(db),
    bacheca: createBachecaService(db),
    servizi: createServiziService(db),
    assemblee: createAssembleaService(db),
  };
}

/** Istanza pronta all'uso nelle schermate: `import { services } from '@/services'`. */
export const services = createServices(supabase);

export * from './assembleaService';
export * from './authService';
export * from './bachecaService';
export * from './condominiService';
export * from './rateService';
export * from './serviziService';
export * from './ticketService';
