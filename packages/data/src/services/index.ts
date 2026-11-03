import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createAssembleaService } from './assembleaService';
import { createAuthService } from './authService';
import { createBachecaService } from './bachecaService';
import { createComunicazioniService } from '../comunicazioni/comunicazioniService';
import { createCondominiService } from './condominiService';
import { createDocumentiService } from '../documenti/documentiService';
import { createFornitoreService } from './fornitoreService';
import { createHomeService } from './homeService';
import { createInvitiService } from './invitiService';
import { createPagamentiService } from '../pagamenti/pagamentiService';
import { createRateService } from './rateService';
import { createProfiloService } from './profiloService';
import { createServiziService } from './serviziService';
import { createSpeseService } from '../spese/speseService';
import { createStrutturaService } from './strutturaService';
import { createTicketService } from './ticketService';

/** Compone tutti i service su un client dato: il client lo crea l'app (nessun singleton qui). */
export function createServices(db: TypedSupabaseClient) {
  return {
    auth: createAuthService(db),
    condomini: createCondominiService(db),
    profilo: createProfiloService(db),
    struttura: createStrutturaService(db),
    rate: createRateService(db),
    pagamenti: createPagamentiService(db),
    spese: createSpeseService(db),
    ticket: createTicketService(db),
    fornitori: createFornitoreService(db),
    bacheca: createBachecaService(db),
    comunicazioni: createComunicazioniService(db),
    documenti: createDocumentiService(db),
    servizi: createServiziService(db),
    assemblee: createAssembleaService(db),
    home: createHomeService(db),
    inviti: createInvitiService(db),
  };
}
export type Services = ReturnType<typeof createServices>;

export * from './assembleaService';
export * from './authService';
export * from './bachecaService';
export * from '../comunicazioni/comunicazioniService';
export * from './condominiService';
export * from '../documenti/documentiService';
export * from './fornitoreService';
export * from './homeService';
export * from './invitiService';
export * from './profiloService';
export * from './rateService';
export * from '../pagamenti/pagamentiService';
export * from './serviziService';
export * from '../spese/speseService';
export * from './ticketService';
