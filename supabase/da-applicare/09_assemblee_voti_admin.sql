-- =============================================================================
-- MIGRAZIONE: Abilitazione Amministratore per inserimento voti assembleari (UC-10)
-- =============================================================================
-- Da eseguire A MANO nell'SQL Editor di Supabase dall'utente se l'admin non-superadmin
-- deve poter inserire o aggiornare i voti nominali per le unità presenti in sala.
-- =============================================================================

drop policy if exists assemblee_voti_insert on public.assemblee_voti;
create policy assemblee_voti_insert on public.assemblee_voti
    for insert
    to authenticated
    with check (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_punto_odg(punto_odg_id))
        or (
            utente_id = auth.uid()
            and public.has_unita_access(unita_id)
            and exists (select 1 from public.assemblee_punti_odg o where o.id = punto_odg_id and o.votazione_aperta)
        )
    );

drop policy if exists assemblee_voti_update on public.assemblee_voti;
create policy assemblee_voti_update on public.assemblee_voti
    for update
    to authenticated
    using (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_punto_odg(punto_odg_id))
        or (
            utente_id = auth.uid()
            and exists (select 1 from public.assemblee_punti_odg o where o.id = punto_odg_id and o.votazione_aperta)
        )
    )
    with check (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_punto_odg(punto_odg_id))
        or (
            utente_id = auth.uid()
            and exists (select 1 from public.assemblee_punti_odg o where o.id = punto_odg_id and o.votazione_aperta)
        )
    );
