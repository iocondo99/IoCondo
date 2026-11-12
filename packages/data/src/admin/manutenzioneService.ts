import { assertOk, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { TablesInsert, TablesUpdate } from '@iocondo/shared-types';
import {
  generaUrlMagicLink,
  trasformaTicketRawInView,
  type FornitoreAdminView,
  type PrioritaTicket,
  type StatoTicket,
  type TicketAdminRaw,
  type TicketAdminView,
  type TipoAmbitoAdmin,
} from './manutenzioneLogic.ts';

export interface OpzioneAmbitoManutenzione {
  id: string;
  tipo: TipoAmbitoAdmin;
  label: string;
  palazzoId: string | null;
  scalaColonnaId: string | null;
}

export interface OpzioneUnitaManutenzione {
  id: string;
  label: string;
  palazzoNome: string;
  interno: string | null;
}

export interface OpzioneCategoriaGuasto {
  id: string;
  nome: string;
}

export interface InputNuovoTicketAdmin {
  condominioId: string;
  titolo: string;
  descrizione?: string | null;
  categoriaId?: string | null;
  priorita?: PrioritaTicket;
  ambitoTipo?: TipoAmbitoAdmin;
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  isAreaComune?: boolean;
  unitaId?: string | null;
  segnalatoreId?: string | null;
}

export interface InputNuovoFornitoreAdmin {
  adminId: string;
  ragioneSociale: string;
  pIva?: string | null;
  iban?: string | null;
  email?: string | null;
  telefono?: string | null;
  categoria?: string | null;
}

export interface InputAssegnaFornitore {
  ticketId: string;
  fornitoreId: string;
  dataPrevista?: string | null;
  note?: string | null;
  baseUrl?: string;
  giorniValidita?: number;
}

export interface InputChiudiTicket {
  ticketId: string;
  importoConsuntivo?: number | null;
  noteFornitore?: string | null;
}

export interface InputModificaTicketAdmin {
  ticketId: string;
  titolo: string;
  descrizione?: string | null;
  categoriaId?: string | null;
  priorita?: PrioritaTicket;
  stato?: StatoTicket;
  ambitoTipo?: TipoAmbitoAdmin;
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  isAreaComune?: boolean;
  unitaId?: string | null;
  fornitoreId?: string | null;
  dataPrevista?: string | null;
  noteFornitore?: string | null;
  baseUrl?: string;
  importoConsuntivo?: number | null;
}

function generaTokenSicuro(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  }
  return `${Math.random().toString(36).substring(2)}${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`;
}

/**
 * Servizio per la gestione di Manutenzione, Ticket e Fornitori lato Amministratore (Passo 5).
 * Modello basato esclusivamente su ambiti condivisi (Condominio / Palazzo / Scala).
 */
export function createManutenzioneService(db: TypedSupabaseClient) {
  return {
    /**
     * Lettura completa di tutti i ticket del condominio attivo, con join su categorie,
     * palazzi, scale/colonne, interventi, fornitori, allegati e messaggi.
     */
    async listTickets(condominioId: string): Promise<TicketAdminView[]> {
      const res = unwrap(
        await db
          .from('ticket_testata')
          .select(`
            id,
            condominio_id,
            palazzo_id,
            scala_colonna_id,
            unita_id,
            segnalatore_id,
            categoria_id,
            titolo,
            descrizione,
            is_area_comune,
            priorita,
            stato,
            created_at,
            updated_at,
            closed_at,
            palazzi (
              id,
              nome_identificativo
            ),
            scale_colonne (
              id,
              nome,
              palazzo_id
            ),
            categorie_guasti (
              id,
              nome
            ),
            unita_immobiliari (
              id,
              interno,
              piano,
              palazzi (
                id,
                nome_identificativo
              )
            ),
            utenti:segnalatore_id (
              id,
              nome_cognome,
              email
            ),
            ticket_interventi (
              id,
              ticket_id,
              fornitore_id,
              data_prevista,
              importo_consuntivo,
              note_fornitore,
              fattura_url,
              foto_lavoro_url,
              created_at,
              fornitori (
                id,
                ragione_sociale
              ),
              fornitori_tokens (
                token,
                url_magico,
                data_scadenza,
                used_at
              )
            ),
            ticket_allegati (
              id,
              ticket_id,
              url_storage,
              tipo_file,
              caricato_da,
              created_at
            ),
            ticket_messaggi (
              id,
              ticket_id,
              mittente_id,
              messaggio,
              timestamp,
              utenti:mittente_id (
                nome_cognome
              )
            )
          `)
          .eq('condominio_id', condominioId)
          .order('created_at', { ascending: false }),
      );

      const righe = (res as unknown as TicketAdminRaw[]) ?? [];
      return righe.map(trasformaTicketRawInView);
    },

    /**
     * Elenco ambiti condivisi disponibili nel condominio per creazione e modifica ticket.
     */
    async listAmbiti(condominioId: string): Promise<OpzioneAmbitoManutenzione[]> {
      const opzioni: OpzioneAmbitoManutenzione[] = [
        {
          id: 'condominio',
          tipo: 'CONDOMINIO',
          label: 'Area comune del condominio (visibile a tutti)',
          palazzoId: null,
          scalaColonnaId: null,
        },
      ];

      const palazziRes = unwrap(
        await db
          .from('palazzi')
          .select('id, nome_identificativo')
          .eq('condominio_id', condominioId)
          .order('nome_identificativo', { ascending: true }),
      );

      const palazzi = palazziRes ?? [];
      const palazziMap = new Map<string, string>();
      for (const p of palazzi) {
        palazziMap.set(p.id, p.nome_identificativo);
        opzioni.push({
          id: `palazzo:${p.id}`,
          tipo: 'PALAZZO',
          label: `Palazzo ${p.nome_identificativo}`,
          palazzoId: p.id,
          scalaColonnaId: null,
        });
      }

      if (palazzi.length > 0) {
        const palIds = palazzi.map((p) => p.id);
        const scaleRes = unwrap(
          await db
            .from('scale_colonne')
            .select('id, nome, palazzo_id')
            .in('palazzo_id', palIds)
            .order('nome', { ascending: true }),
        );
        for (const s of scaleRes ?? []) {
          const pNome = palazziMap.get(s.palazzo_id) ?? 'Palazzo';
          opzioni.push({
            id: `scala:${s.palazzo_id}:${s.id}`,
            tipo: 'SCALA',
            label: `Palazzo ${pNome} · Scala ${s.nome}`,
            palazzoId: s.palazzo_id,
            scalaColonnaId: s.id,
          });
        }
      }

      return opzioni;
    },

    /**
     * Rubrica fornitori convenzionati dell'amministratore.
     */
    async listFornitori(adminId?: string): Promise<FornitoreAdminView[]> {
      let q = db
        .from('fornitori')
        .select('id, admin_id, ragione_sociale, p_iva, iban, email, telefono, categoria, created_at')
        .order('ragione_sociale', { ascending: true });

      if (adminId) {
        q = q.eq('admin_id', adminId);
      }

      const fornitori = unwrap(await q);
      return (fornitori as FornitoreAdminView[]) ?? [];
    },

    /**
     * Aggiunta nuovo fornitore convenzionato in rubrica.
     */
    async createFornitore(input: InputNuovoFornitoreAdmin): Promise<FornitoreAdminView> {
      const payload: TablesInsert<'fornitori'> = {
        admin_id: input.adminId,
        ragione_sociale: input.ragioneSociale.trim(),
        p_iva: input.pIva?.trim() || null,
        iban: input.iban?.trim() || null,
        email: input.email?.trim() || null,
        telefono: input.telefono?.trim() || null,
        categoria: input.categoria?.trim() || null,
      };

      const creato = unwrap(
        await db.from('fornitori').insert(payload).select().single(),
      );

      return creato as FornitoreAdminView;
    },

    /**
     * Elenco categorie guasti.
     */
    async listCategorie(): Promise<OpzioneCategoriaGuasto[]> {
      const res = unwrap(
        await db.from('categorie_guasti').select('id, nome').order('nome'),
      );
      return res ?? [];
    },

    /**
     * Elenco unità immobiliari (retrocompatibile per vecchie visualizzazioni).
     */
    async listUnita(condominioId: string): Promise<OpzioneUnitaManutenzione[]> {
      const res = unwrap(
        await db
          .from('unita_immobiliari')
          .select(`
            id,
            interno,
            piano,
            palazzi!inner (
              id,
              condominio_id,
              nome_identificativo
            )
          `)
          .eq('palazzi.condominio_id', condominioId)
          .order('interno', { ascending: true }),
      );

      return (res ?? []).map((u: any) => {
        const palazzo = Array.isArray(u.palazzi) ? u.palazzi[0] : u.palazzi;
        const pNome = palazzo?.nome_identificativo ?? 'Palazzo';
        const label = [pNome, u.interno ? `Int. ${u.interno}` : null, u.piano !== null ? `P. ${u.piano}` : null]
          .filter(Boolean)
          .join(' - ');
        return {
          id: u.id,
          label,
          palazzoNome: pNome,
          interno: u.interno,
        };
      });
    },

    /**
     * Creazione nuovo ticket da parte dell'amministratore su ambito condiviso (Condominio, Palazzo o Scala).
     * Non assegna mai unita_id (nessun ticket privato 1-a-1).
     */
    async createTicket(input: InputNuovoTicketAdmin): Promise<{ id: string }> {
      let palazzoId: string | null = null;
      let scalaColonnaId: string | null = null;

      const tipo = input.ambitoTipo || (input.scalaColonnaId ? 'SCALA' : (input.palazzoId ? 'PALAZZO' : 'CONDOMINIO'));
      if (tipo === 'SCALA') {
        palazzoId = input.palazzoId ?? null;
        scalaColonnaId = input.scalaColonnaId ?? null;
      } else if (tipo === 'PALAZZO') {
        palazzoId = input.palazzoId ?? null;
        scalaColonnaId = null;
      }

      const payload: TablesInsert<'ticket_testata'> = {
        condominio_id: input.condominioId,
        palazzo_id: palazzoId,
        scala_colonna_id: scalaColonnaId,
        unita_id: null,
        titolo: input.titolo.trim(),
        descrizione: input.descrizione?.trim() || null,
        categoria_id: input.categoriaId || null,
        priorita: input.priorita || 'MEDIA',
        is_area_comune: true,
        segnalatore_id: input.segnalatoreId || null,
        stato: 'APERTO',
      };

      const creato = unwrap(
        await db.from('ticket_testata').insert(payload).select('id').single(),
      );

      return { id: creato.id };
    },

    /**
     * Assegna il ticket a un fornitore convenzionato:
     * 1. Crea record in `ticket_interventi`
     * 2. Genera token temporaneo (+14 giorni) in `fornitori_tokens`
     * 3. Aggiorna stato ticket in 'LAVORAZIONE'
     */
    async assegnaFornitore(input: InputAssegnaFornitore): Promise<{
      interventoId: string;
      token: string;
      urlMagico: string;
      dataScadenza: string;
    }> {
      const interventoPayload: TablesInsert<'ticket_interventi'> = {
        ticket_id: input.ticketId,
        fornitore_id: input.fornitoreId,
        data_prevista: input.dataPrevista || null,
        note_fornitore: input.note?.trim() || null,
      };

      const intervento = unwrap(
        await db.from('ticket_interventi').insert(interventoPayload).select('id').single(),
      );

      const token = generaTokenSicuro();
      const giorni = input.giorniValidita ?? 14;
      const scadenza = new Date(Date.now() + giorni * 86_400_000).toISOString();
      const urlMagico = generaUrlMagicLink(token, input.baseUrl);

      const tokenPayload: TablesInsert<'fornitori_tokens'> = {
        token,
        ticket_intervento_id: intervento.id,
        url_magico: urlMagico,
        data_scadenza: scadenza,
      };

      unwrap(await db.from('fornitori_tokens').insert(tokenPayload).select('token').single());

      assertOk(
        await db
          .from('ticket_testata')
          .update({ stato: 'LAVORAZIONE', updated_at: new Date().toISOString() })
          .eq('id', input.ticketId),
      );

      return {
        interventoId: intervento.id,
        token,
        urlMagico,
        dataScadenza: scadenza,
      };
    },

    /**
     * Chiusura / risoluzione del ticket:
     * 1. Aggiorna stato in 'RISOLTO' e imposta `closed_at`
     * 2. Registra consuntivo spesa e note sull'ultimo intervento associato
     */
    async chiudiTicket(input: InputChiudiTicket): Promise<void> {
      assertOk(
        await db
          .from('ticket_testata')
          .update({
            stato: 'RISOLTO',
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.ticketId),
      );

      if (input.importoConsuntivo !== undefined || input.noteFornitore) {
        const ultimiInterventi = unwrap(
          await db
            .from('ticket_interventi')
            .select('id')
            .eq('ticket_id', input.ticketId)
            .order('created_at', { ascending: false })
            .limit(1),
        );

        const primoIntervento = ultimiInterventi?.[0];
        if (primoIntervento) {
          const interventoId = primoIntervento.id;
          const patch: TablesUpdate<'ticket_interventi'> = {};
          if (input.importoConsuntivo !== undefined) {
            patch.importo_consuntivo = input.importoConsuntivo;
          }
          if (input.noteFornitore !== undefined) {
            patch.note_fornitore = input.noteFornitore?.trim() || null;
          }

          assertOk(
            await db
              .from('ticket_interventi')
              .update(patch)
              .eq('id', interventoId),
          );
        }
      }
    },

    /**
     * Modifica generale di un ticket esistente (titolo, priorità, stato, ambito, fornitore/intervento).
     */
    async updateTicket(input: InputModificaTicketAdmin): Promise<{ urlMagico?: string }> {
      let palazzoId: string | null = null;
      let scalaColonnaId: string | null = null;

      const tipo = input.ambitoTipo || (input.scalaColonnaId ? 'SCALA' : (input.palazzoId ? 'PALAZZO' : 'CONDOMINIO'));
      if (tipo === 'SCALA') {
        palazzoId = input.palazzoId ?? null;
        scalaColonnaId = input.scalaColonnaId ?? null;
      } else if (tipo === 'PALAZZO') {
        palazzoId = input.palazzoId ?? null;
        scalaColonnaId = null;
      }

      const patch: TablesUpdate<'ticket_testata'> = {
        titolo: input.titolo.trim(),
        descrizione: input.descrizione?.trim() || null,
        categoria_id: input.categoriaId || null,
        priorita: input.priorita || 'MEDIA',
        stato: input.stato || 'APERTO',
        is_area_comune: true,
        palazzo_id: palazzoId,
        scala_colonna_id: scalaColonnaId,
        unita_id: null,
        updated_at: new Date().toISOString(),
      };
      if (input.stato === 'RISOLTO') {
        patch.closed_at = new Date().toISOString();
      } else if (input.stato === 'APERTO' || input.stato === 'LAVORAZIONE') {
        patch.closed_at = null;
      }

      assertOk(await db.from('ticket_testata').update(patch).eq('id', input.ticketId));

      let resUrlMagico: string | undefined;

      if (input.fornitoreId) {
        const ultimiInterventi = unwrap(
          await db
            .from('ticket_interventi')
            .select('id, fornitore_id')
            .eq('ticket_id', input.ticketId)
            .order('created_at', { ascending: false })
            .limit(1),
        );

        const primoIntervento = ultimiInterventi?.[0];
        if (primoIntervento) {
          const intId = primoIntervento.id;
          const patchInt: TablesUpdate<'ticket_interventi'> = {
            fornitore_id: input.fornitoreId,
            data_prevista: input.dataPrevista || null,
            note_fornitore: input.noteFornitore?.trim() || null,
          };
          if (input.importoConsuntivo !== undefined) {
            patchInt.importo_consuntivo = input.importoConsuntivo;
          }
          assertOk(await db.from('ticket_interventi').update(patchInt).eq('id', intId));

          const tokens = unwrap(
            await db
              .from('fornitori_tokens')
              .select('url_magico')
              .eq('ticket_intervento_id', intId)
              .limit(1),
          );
          const primoToken = tokens?.[0];
          if (primoToken?.url_magico) {
            resUrlMagico = primoToken.url_magico;
          } else {
            const token = generaTokenSicuro();
            const scadenza = new Date(Date.now() + 14 * 86_400_000).toISOString();
            const urlMagico = generaUrlMagicLink(token, input.baseUrl);
            await db.from('fornitori_tokens').insert({
              token,
              ticket_intervento_id: intId,
              url_magico: urlMagico,
              data_scadenza: scadenza,
            });
            resUrlMagico = urlMagico;
          }
        } else {
          const resInt = unwrap(
            await db
              .from('ticket_interventi')
              .insert({
                ticket_id: input.ticketId,
                fornitore_id: input.fornitoreId,
                data_prevista: input.dataPrevista || null,
                note_fornitore: input.noteFornitore?.trim() || null,
                importo_consuntivo: input.importoConsuntivo || null,
              })
              .select('id')
              .single(),
          );
          const token = generaTokenSicuro();
          const scadenza = new Date(Date.now() + 14 * 86_400_000).toISOString();
          const urlMagico = generaUrlMagicLink(token, input.baseUrl);
          await db.from('fornitori_tokens').insert({
            token,
            ticket_intervento_id: resInt.id,
            url_magico: urlMagico,
            data_scadenza: scadenza,
          });
          resUrlMagico = urlMagico;
        }
      }

      return { urlMagico: resUrlMagico };
    },

    /**
     * Aggiunge un messaggio al ticket.
     */
    async addMessaggio(ticketId: string, messaggio: string, mittenteId?: string | null): Promise<void> {
      const payload: TablesInsert<'ticket_messaggi'> = {
        ticket_id: ticketId,
        mittente_id: mittenteId || null,
        messaggio: messaggio.trim(),
        timestamp: new Date().toISOString(),
      };

      assertOk(await db.from('ticket_messaggi').insert(payload));
    },
  };
}

export type ManutenzioneService = ReturnType<typeof createManutenzioneService>;
