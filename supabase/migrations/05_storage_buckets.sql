-- =====================================================================
-- 05_storage_buckets.sql
-- Inizializzazione Bucket di Storage Cloud e Policy RLS (storage.objects)
-- =====================================================================
--
-- Bucket previsti:
--   1. `ricevute-rate`        (Privato: accessibile solo dall'amministratore del condominio
--                              e dal condòmino proprietario/debitore dell'unità).
--   2. `foto-guasti`          (Pubblico in lettura per condòmini e fornitori con magic link,
--                              upload consentito solo a utenti autenticati del condominio).
--   3. `documenti-condominio` (Privato: verbali assemblee, regolamento, polizze; accessibile
--                              ai membri del condominio secondo i permessi documentali).
--   4. `avatar-utenti`        (Pubblico in lettura; scrittura vincolata al proprio auth.uid()).
--
-- Convenzione di path nei bucket multi-tenant:
--   * `ricevute-rate`:        `<condominio_id>/<unita_id>/<filename>.pdf`
--   * `foto-guasti`:          `<condominio_id>/<ticket_id>/<filename>.jpg`
--   * `documenti-condominio`: `<condominio_id>/<cartella_o_doc>/<filename>.pdf`
--   * `avatar-utenti`:        `<utente_uuid>/<filename>.png`
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CREAZIONE DEI 4 BUCKET IN `storage.buckets`
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    (
        'ricevute-rate',
        'ricevute-rate',
        false,
        10485760, -- 10 MB
        array['application/pdf', 'image/png', 'image/jpeg']
    ),
    (
        'foto-guasti',
        'foto-guasti',
        true,
        15728640, -- 15 MB
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    ),
    (
        'documenti-condominio',
        'documenti-condominio',
        false,
        52428800, -- 50 MB
        array[
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png'
        ]
    ),
    (
        'avatar-utenti',
        'avatar-utenti',
        true,
        5242880, -- 5 MB
        array['image/jpeg', 'image/png', 'image/webp']
    )
on conflict (id) do update
set
    public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. FUNZIONI HELPER PER ESTRARRE IL TENANT / UUID DAL PATH STORAGE
--    (Safe parsing: restituisce NULL se il segmento non è un UUID valido)
-- ---------------------------------------------------------------------

create or replace function public.try_parse_uuid(p_text text)
returns uuid
language plpgsql immutable security definer set search_path = public
as $$
begin
    if p_text is null or p_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        return null;
    end if;
    return p_text::uuid;
end;
$$;

revoke all on function public.try_parse_uuid(text) from public;
grant execute on function public.try_parse_uuid(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. POLICY RLS SU `storage.objects`
-- ---------------------------------------------------------------------

-- Pulizia eventuali policy preesistenti con lo stesso nome
drop policy if exists ricevute_rate_select on storage.objects;
drop policy if exists ricevute_rate_insert on storage.objects;
drop policy if exists ricevute_rate_update on storage.objects;
drop policy if exists ricevute_rate_delete on storage.objects;

drop policy if exists foto_guasti_select on storage.objects;
drop policy if exists foto_guasti_insert on storage.objects;
drop policy if exists foto_guasti_update on storage.objects;
drop policy if exists foto_guasti_delete on storage.objects;

drop policy if exists documenti_condominio_select on storage.objects;
drop policy if exists documenti_condominio_insert on storage.objects;
drop policy if exists documenti_condominio_update on storage.objects;
drop policy if exists documenti_condominio_delete on storage.objects;

drop policy if exists avatar_utenti_select on storage.objects;
drop policy if exists avatar_utenti_insert on storage.objects;
drop policy if exists avatar_utenti_update on storage.objects;
drop policy if exists avatar_utenti_delete on storage.objects;

-- =====================================================================
-- BUCKET A: `ricevute-rate` (Privato)
-- Path atteso: `<condominio_uuid>/<unita_uuid>/<file>`
-- Lettura: Amministratore del condominio OPPURE condòmino con accesso
--          all'unità immobiliare (o owner diretto del file).
-- Scrittura/Cancellazione: Solo Amministratore del condominio.
-- =====================================================================

create policy ricevute_rate_select on storage.objects
for select to authenticated
using (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
        or public.has_unita_access(public.try_parse_uuid((storage.foldername(name))[2]))
    )
);

create policy ricevute_rate_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy ricevute_rate_update on storage.objects
for update to authenticated
using (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
)
with check (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy ricevute_rate_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

-- =====================================================================
-- BUCKET B: `foto-guasti` (Pubblico in lettura per condòmini e fornitori
--           con magic link; upload autenticato vincolato al condominio)
-- Path atteso: `<condominio_uuid>/<ticket_uuid>/<file>`
-- =====================================================================

create policy foto_guasti_select on storage.objects
for select to anon, authenticated
using (
    bucket_id = 'foto-guasti'
);

create policy foto_guasti_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or public.has_cond_access(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy foto_guasti_update on storage.objects
for update to authenticated
using (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
)
with check (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy foto_guasti_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

-- =====================================================================
-- BUCKET C: `documenti-condominio` (Privato: verbali assemblee, regolamento)
-- Path atteso: `<condominio_uuid>/<cartella_o_categoria>/<file>`
-- Lettura: Utenti appartenenti al tenant condominio (`has_cond_access`).
-- Scrittura/Modifica/Cancellazione: Solo Amministratore del condominio (`is_admin_of`).
-- =====================================================================

create policy documenti_condominio_select on storage.objects
for select to authenticated
using (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.has_cond_access(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy documenti_condominio_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy documenti_condominio_update on storage.objects
for update to authenticated
using (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
)
with check (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy documenti_condominio_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

-- =====================================================================
-- BUCKET D: `avatar-utenti` (Pubblico in lettura; scrittura nella propria
--           cartella `<auth.uid()>/<filename>`)
-- =====================================================================

create policy avatar_utenti_select on storage.objects
for select to anon, authenticated
using (
    bucket_id = 'avatar-utenti'
);

create policy avatar_utenti_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
);

create policy avatar_utenti_update on storage.objects
for update to authenticated
using (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
)
with check (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
);

create policy avatar_utenti_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
);
