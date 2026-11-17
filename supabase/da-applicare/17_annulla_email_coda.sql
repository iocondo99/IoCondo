-- Annullamento di un'email in coda da parte dell'amministratore (Log & Coda Email).
-- DA APPLICARE dal SQL Editor di Supabase, dopo 14_coda_email_gmail.sql.
--
-- Cosa fa:
--   - annulla_email_coda(p_id): porta l'email a stato CANCELLED, solo se e' ancora PENDING o FAILED.
--   - Controllo sul database con auth.uid(): solo l'amministratore del condominio dell'email
--     (o il super amministratore, tramite is_admin_of) puo' annullarla.
--   - Le email gia' inviate (SENT) o in invio in questo momento (PROCESSING) non si toccano.
--   - Nessuna cancellazione fisica: la riga resta nel log come "Annullata".
--   - Il worker preleva solo le righe PENDING, quindi un'email annullata non parte piu'.
--   - Restituisce true se l'email e' stata annullata, false se non era piu' annullabile.

begin;

create or replace function public.annulla_email_coda(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_condominio uuid;
    v_aggiornate integer;
begin
    if auth.uid() is null then
        raise exception 'Non autorizzato' using errcode = '42501';
    end if;

    select condominio_id into v_condominio from public.coda_email where id = p_id;
    if v_condominio is null then
        raise exception 'Email non trovata' using errcode = 'P0002';
    end if;
    if not public.is_admin_of(v_condominio) then
        raise exception 'Non autorizzato' using errcode = '42501';
    end if;

    update public.coda_email
       set stato = 'CANCELLED',
           ultimo_errore = coalesce(ultimo_errore, 'Annullata dall''amministratore'),
           updated_at = now()
     where id = p_id
       and stato in ('PENDING', 'FAILED');
    get diagnostics v_aggiornate = row_count;
    return v_aggiornate > 0;
end;
$$;

revoke all on function public.annulla_email_coda(uuid) from public, anon;
grant execute on function public.annulla_email_coda(uuid) to authenticated;

commit;

-- ROLLBACK (non eseguito):
-- drop function if exists public.annulla_email_coda(uuid);
