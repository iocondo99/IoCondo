import { assertOk, invokeFunction, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { Json } from '@iocondo/shared-types';
import {
  calcolaKpiPiattaforma,
  calcolaNuovaScadenzaLicenza,
  calcolaStatoLicenza,
  FEATURE_PIANO_UNICO,
  NOME_PIANO_UNICO_DEFAULT,
  type AmministratoreConCondomini,
  type CondominioSuperAdmin,
  type FatturaSaasView,
  type KpiPiattaforma,
  type LicenzaSuperAdmin,
  type PianoUnicoView,
} from './superadminLogic';

export interface AggiornaPianoUnicoInput {
  id: string;
  nome?: string;
  prezzoMensile: number;
  note?: string;
  featurePremium?: Record<string, boolean>;
}

export interface RisultatoInvitoAdmin {
  messaggio: string;
  giaRegistrato: boolean;
}

function parsePiano(row: {
  id: string;
  nome: string;
  prezzo_mensile: number;
  limite_unita: number | null;
  feature_premium: Json;
  updated_at: string;
}): PianoUnicoView {
  const fp =
    row.feature_premium && typeof row.feature_premium === 'object' && !Array.isArray(row.feature_premium)
      ? (row.feature_premium as Record<string, unknown>)
      : {};
  const note = typeof fp.note === 'string' ? fp.note : 'Accesso completo a tutte le funzionalità della piattaforma.';
  const featureAttive = FEATURE_PIANO_UNICO.filter((f) => fp[f.key] !== false).map((f) => f.key);
  return {
    id: row.id,
    nome: row.nome,
    prezzoMensile: Number(row.prezzo_mensile),
    limiteUnita: row.limite_unita,
    note,
    featureAttive,
    updatedAt: row.updated_at,
  };
}

export function createSuperAdminService(db: TypedSupabaseClient) {
  async function ensurePianoUnicoRow() {
    const piani = unwrap(
      await db.from('piani_abbonamento').select('*').order('created_at', { ascending: true }),
    );
    const preferito = piani.find((p) => p.nome === NOME_PIANO_UNICO_DEFAULT) ?? piani[0];
    if (preferito) return preferito;

    const featureDefault: Record<string, Json> = {
      note: 'Accesso completo a tutte le funzionalità della piattaforma senza limiti di unità.',
    };
    for (const f of FEATURE_PIANO_UNICO) featureDefault[f.key] = true;

    return unwrap(
      await db
        .from('piani_abbonamento')
        .insert({
          nome: NOME_PIANO_UNICO_DEFAULT,
          prezzo_mensile: 29.0,
          limite_unita: null,
          feature_premium: featureDefault,
        })
        .select('*')
        .single(),
    );
  }

  return {
    async elencoAmministratoriConCondomini(): Promise<AmministratoreConCondomini[]> {
      const [
        resCondomini,
        palazzi,
        unita,
        licenze,
        piani,
        ruoli,
        uerAdmin,
        utenti,
      ] = await Promise.all([
        db.from('condomini').select('id, admin_id, nome, indirizzo, citta, attivo').order('nome'),
        db.from('palazzi').select('id, condominio_id'),
        db.from('unita_immobiliari').select('id, palazzo_id'),
        db.from('licenze_saas').select('id, admin_id, piano_id, is_active, data_scadenza'),
        db.from('piani_abbonamento').select('id, nome'),
        db.from('ruoli_piattaforma').select('id, codice'),
        db.from('utente_entita_ruolo').select('utente_id, ruolo_id, condominio_id'),
        db.from('utenti').select('id, email, nome_cognome, telefono, created_at').order('created_at', { ascending: false }),
      ]);

      let condominiRaw: Array<{
        id: string;
        admin_id: string;
        nome: string;
        indirizzo: string | null;
        citta: string | null;
        attivo: boolean;
      }>;
      if (resCondomini.error) {
        const fallback = unwrap(
          await db.from('condomini').select('id, admin_id, nome, indirizzo, citta').order('nome'),
        );
        condominiRaw = fallback.map((c) => ({ ...c, attivo: true }));
      } else {
        condominiRaw = (resCondomini.data ?? []).map((c) => ({ ...c, attivo: c.attivo ?? true }));
      }

      const palazziList = unwrap(palazzi);
      const unitaList = unwrap(unita);
      const licenzeList = unwrap(licenze);
      const pianiList = unwrap(piani);
      const ruoliList = unwrap(ruoli);
      const uerList = unwrap(uerAdmin);
      const utentiList = unwrap(utenti);

      const palazziPerCond = new Map<string, number>();
      const condOfPalazzo = new Map<string, string>();
      for (const p of palazziList) {
        condOfPalazzo.set(p.id, p.condominio_id);
        palazziPerCond.set(p.condominio_id, (palazziPerCond.get(p.condominio_id) ?? 0) + 1);
      }

      const unitaPerCond = new Map<string, number>();
      for (const u of unitaList) {
        const cid = condOfPalazzo.get(u.palazzo_id);
        if (cid) unitaPerCond.set(cid, (unitaPerCond.get(cid) ?? 0) + 1);
      }

      const pianoNomeDi = new Map(pianiList.map((p) => [p.id, p.nome]));
      const licenzaDiAdmin = new Map<string, LicenzaSuperAdmin>();
      for (const l of licenzeList) {
        licenzaDiAdmin.set(l.admin_id, {
          id: l.id,
          pianoId: l.piano_id,
          pianoNome: pianoNomeDi.get(l.piano_id) ?? NOME_PIANO_UNICO_DEFAULT,
          isActive: l.is_active,
          dataScadenza: l.data_scadenza,
          stato: calcolaStatoLicenza(l),
        });
      }

      const adminRoleId = ruoliList.find((r) => r.codice === 'ADMIN')?.id;
      const adminIds = new Set<string>();
      for (const l of licenzeList) adminIds.add(l.admin_id);
      for (const c of condominiRaw) adminIds.add(c.admin_id);
      if (adminRoleId) {
        for (const r of uerList) {
          if (r.ruolo_id === adminRoleId) adminIds.add(r.utente_id);
        }
      }

      const condominiPerAdmin = new Map<string, CondominioSuperAdmin[]>();
      for (const c of condominiRaw) {
        const item: CondominioSuperAdmin = {
          id: c.id,
          adminId: c.admin_id,
          nome: c.nome,
          indirizzo: c.indirizzo,
          citta: c.citta,
          attivo: c.attivo,
          numeroPalazzi: palazziPerCond.get(c.id) ?? 0,
          numeroUnita: unitaPerCond.get(c.id) ?? 0,
        };
        const lista = condominiPerAdmin.get(c.admin_id) ?? [];
        lista.push(item);
        condominiPerAdmin.set(c.admin_id, lista);
      }

      const utenteDiId = new Map(utentiList.map((u) => [u.id, u]));
      const risultato: AmministratoreConCondomini[] = [];
      for (const id of adminIds) {
        const u = utenteDiId.get(id);
        risultato.push({
          id,
          email: u?.email ?? null,
          nomeCognome: u?.nome_cognome ?? null,
          telefono: u?.telefono ?? null,
          createdAt: u?.created_at ?? new Date().toISOString(),
          licenza: licenzaDiAdmin.get(id) ?? null,
          condomini: condominiPerAdmin.get(id) ?? [],
        });
      }

      return risultato.sort((a, b) =>
        (a.nomeCognome ?? a.email ?? a.id).localeCompare(b.nomeCognome ?? b.email ?? b.id, 'it'),
      );
    },

    async getKpiPiattaforma(): Promise<KpiPiattaforma> {
      const amministratori = await this.elencoAmministratoriConCondomini();
      return calcolaKpiPiattaforma(amministratori);
    },

    async setCondominioAttivo(condominioId: string, attivo: boolean): Promise<void> {
      assertOk(await db.from('condomini').update({ attivo }).eq('id', condominioId));
    },

    async invitaAmministratore(email: string, nomeCognome: string): Promise<RisultatoInvitoAdmin> {
      const emailPulita = email.trim().toLowerCase();
      const nomePulito = nomeCognome.trim();
      const piano = await ensurePianoUnicoRow();

      const esistente = unwrap(
        await db.from('utenti').select('id, nome_cognome').eq('email', emailPulita).maybeSingle(),
      );

      if (esistente) {
        if (!esistente.nome_cognome && nomePulito) {
          assertOk(await db.from('utenti').update({ nome_cognome: nomePulito }).eq('id', esistente.id));
        }
        const licenza = unwrap(
          await db.from('licenze_saas').select('id, data_scadenza').eq('admin_id', esistente.id).maybeSingle(),
        );
        const nuovaScadenza = calcolaNuovaScadenzaLicenza(licenza?.data_scadenza ?? null, 12);
        if (licenza) {
          assertOk(
            await db
              .from('licenze_saas')
              .update({ piano_id: piano.id, is_active: true, data_scadenza: nuovaScadenza })
              .eq('id', licenza.id),
          );
        } else {
          assertOk(
            await db.from('licenze_saas').insert({
              admin_id: esistente.id,
              piano_id: piano.id,
              is_active: true,
              data_scadenza: nuovaScadenza,
            }),
          );
        }
        return {
          messaggio: `Amministratore ${nomePulito} accreditato al ${piano.nome} con licenza attiva.`,
          giaRegistrato: true,
        };
      }

      // Utente non ancora registrato: invia invito via Edge Function `invita-utente`
      await invokeFunction<{ ok: true }>(db, 'invita-utente', {
        email: emailPulita,
        ruolo: 'ADMIN',
        nome_cognome: nomePulito,
        piano_id: piano.id,
      });

      return {
        messaggio: `Invito inviato a ${emailPulita} con associazione al ${piano.nome}.`,
        giaRegistrato: false,
      };
    },

    async getPianoUnico(): Promise<PianoUnicoView> {
      const row = await ensurePianoUnicoRow();
      return parsePiano(row);
    },

    async aggiornaPianoUnico(input: AggiornaPianoUnicoInput): Promise<PianoUnicoView> {
      const corrente = unwrap(
        await db.from('piani_abbonamento').select('*').eq('id', input.id).single(),
      );
      const fpCorrente =
        corrente.feature_premium &&
        typeof corrente.feature_premium === 'object' &&
        !Array.isArray(corrente.feature_premium)
          ? { ...(corrente.feature_premium as Record<string, Json>) }
          : {};

      if (input.note !== undefined) {
        fpCorrente.note = input.note.trim();
      }
      if (input.featurePremium) {
        for (const [k, v] of Object.entries(input.featurePremium)) {
          fpCorrente[k] = v;
        }
      }

      const updated = unwrap(
        await db
          .from('piani_abbonamento')
          .update({
            ...(input.nome ? { nome: input.nome.trim() } : {}),
            prezzo_mensile: input.prezzoMensile,
            feature_premium: fpCorrente,
          })
          .eq('id', input.id)
          .select('*')
          .single(),
      );
      return parsePiano(updated);
    },

    async rinnovaLicenzaAmministratore(adminId: string, mesi: number): Promise<LicenzaSuperAdmin> {
      const piano = await ensurePianoUnicoRow();
      const esistente = unwrap(
        await db.from('licenze_saas').select('*').eq('admin_id', adminId).maybeSingle(),
      );
      const nuovaScadenza = calcolaNuovaScadenzaLicenza(esistente?.data_scadenza ?? null, mesi);

      const salvata = esistente
        ? unwrap(
            await db
              .from('licenze_saas')
              .update({ piano_id: piano.id, is_active: true, data_scadenza: nuovaScadenza })
              .eq('id', esistente.id)
              .select('*')
              .single(),
          )
        : unwrap(
            await db
              .from('licenze_saas')
              .insert({
                admin_id: adminId,
                piano_id: piano.id,
                is_active: true,
                data_scadenza: nuovaScadenza,
              })
              .select('*')
              .single(),
          );

      return {
        id: salvata.id,
        pianoId: salvata.piano_id,
        pianoNome: piano.nome,
        isActive: salvata.is_active,
        dataScadenza: salvata.data_scadenza,
        stato: calcolaStatoLicenza(salvata),
      };
    },

    async elencoFattureSaaS(): Promise<FatturaSaasView[]> {
      const [fatture, utenti] = await Promise.all([
        db.from('fatture_saas').select('id, admin_id, importo, url_pdf, data_emissione').order('data_emissione', { ascending: false }),
        db.from('utenti').select('id, nome_cognome, email'),
      ]);

      const fattureList = unwrap(fatture);
      const utentiList = unwrap(utenti);
      const utenteDi = new Map(utentiList.map((u) => [u.id, u]));

      return fattureList.map((f) => {
        const u = utenteDi.get(f.admin_id);
        return {
          id: f.id,
          adminId: f.admin_id,
          adminNome: u?.nome_cognome ?? u?.email ?? 'Amministratore',
          adminEmail: u?.email ?? null,
          importo: Number(f.importo),
          urlPdf: f.url_pdf,
          dataEmissione: f.data_emissione,
        };
      });
    },
  };
}

export type SuperAdminService = ReturnType<typeof createSuperAdminService>;
