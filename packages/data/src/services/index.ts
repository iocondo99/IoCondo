import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createAssistenzaService } from '../assistenza/assistenzaService';
import { createAssembleeService } from '../assemblee/assembleeService';
import { createAuthService } from './authService';
import { createBachecaService } from './bachecaService';
import { createComunicazioniService } from '../comunicazioni/comunicazioniService';
import { createCondominiService } from './condominiService';
import { createDocumentiService } from '../documenti/documentiService';
import { createFornitoreService } from './fornitoreService';
import { createHomeService } from './homeService';
import { createInvitiService } from './invitiService';
import { createPacchiService } from '../pacchi/pacchiService';
import { createPagamentiService } from '../pagamenti/pagamentiService';
import { createRateService } from './rateService';
import { createProfiloService } from './profiloService';
import { createSegnalazioniService } from '../segnalazioni/segnalazioniService';
import { createServiziService } from './serviziService';
import { createSpeseService } from '../spese/speseService';
import { createStrutturaService } from '../admin/strutturaService';
import { createTicketService } from './ticketService';
import { createAdminDashboardService } from '../admin/adminDashboardService';
import { createInvitiAdminService } from '../admin/invitiAdminService';
import { createComunicazioniAdminService } from '../admin/comunicazioniAdminService';
import { createManutenzioneService } from '../admin/manutenzioneService';

/** Compone tutti i service su un client dato: il client lo crea l'app (nessun singleton qui). */
export function createServices(db: TypedSupabaseClient) {
  return {
    adminDashboard: createAdminDashboardService(db),
    auth: createAuthService(db),
    condomini: createCondominiService(db),
    profilo: createProfiloService(db),
    struttura: createStrutturaService(db),
    invitiAdmin: createInvitiAdminService(db),
    comunicazioniAdmin: createComunicazioniAdminService(db),
    manutenzione: createManutenzioneService(db),
    rate: createRateService(db),
    pagamenti: createPagamentiService(db),
    spese: createSpeseService(db),
    ticket: createTicketService(db),
    fornitori: createFornitoreService(db),
    bacheca: createBachecaService(db),
    comunicazioni: createComunicazioniService(db),
    documenti: createDocumentiService(db),
    segnalazioni: createSegnalazioniService(db),
    pacchi: createPacchiService(db),
    servizi: createServiziService(db),
    assemblee: createAssembleeService(db),
    assistenza: createAssistenzaService(db),
    home: createHomeService(db),
    inviti: createInvitiService(db),
  };
}
export type Services = ReturnType<typeof createServices>;

export * from '../admin/adminDashboardService';
export * from '../assemblee/assembleeService';
export * from '../assistenza/assistenzaService';
export * from './assembleaService';
export * from './authService';
export * from './bachecaService';
export * from '../comunicazioni/comunicazioniService';
export * from './condominiService';
export * from '../documenti/documentiService';
export * from './fornitoreService';
export * from './homeService';
export * from './invitiService';
export * from '../pacchi/pacchiService';
export * from './profiloService';
export * from './rateService';
export * from '../pagamenti/pagamentiService';
export * from '../segnalazioni/segnalazioniService';
export * from './serviziService';
export * from '../spese/speseService';
export * from '../admin/strutturaService';
export * from '../admin/invitiAdminService';
export * from '../admin/comunicazioniAdminService';
export * from '../admin/manutenzioneService';
export * from './ticketService';
