-- =====================================================================
-- 08a_verifica.sql
-- Solo query di LETTURA. Da eseguire dopo 08a_fix_trigger_e_ruoli.sql
-- per confermare che le correzioni siano attive.
-- =====================================================================

-- ---------------------------------------------------------------- 1. Definizione di handle_user_confirmed
-- Deve contenere un blocco BEGIN/EXCEPTION WHEN OTHERS THEN RAISE WARNING
-- e NON contenere RAISE EXCEPTION.
select 'handle_user_confirmed: definizione' as verifica,
       case
           when def like '%exception when others%' and def like '%raise warning%'
                and def not like '%raise exception%'
           then 'OK — handler warning presente, nessun raise exception'
           else 'ATTENZIONE — handler mancante o raise exception presente'
       end as esito,
       def as definizione_completa
from (
    select pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_user_confirmed'
) t;

-- ---------------------------------------------------------------- 2. Definizione di handle_new_user
-- Deve contenere il sotto-blocco per applica_inviti con RAISE WARNING
-- e NON contenere RAISE EXCEPTION.
select 'handle_new_user: definizione' as verifica,
       case
           when def like '%exception when others%' and def like '%raise warning%'
                and def not like '%raise exception%'
           then 'OK — handler warning presente, nessun raise exception'
           else 'ATTENZIONE — handler mancante o raise exception presente'
       end as esito,
       def as definizione_completa
from (
    select pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
) t;

-- ---------------------------------------------------------------- 3. Policy utente_entita_ruolo_insert
-- La with check deve contenere ruolo_non_admin.
select 'utente_entita_ruolo_insert: policy' as verifica,
       case
           when chk like '%ruolo_non_admin%'
           then 'OK — ruolo_non_admin presente nella with check'
           else 'ATTENZIONE — ruolo_non_admin assente'
       end as esito,
       chk as with_check_expr
from (
    select pg_get_expr(pol.polwithcheck, pol.polrelid) as chk
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where c.relname = 'utente_entita_ruolo' and pol.polname = 'utente_entita_ruolo_insert'
) t;

-- ---------------------------------------------------------------- 4. Policy utente_entita_ruolo_update
-- Sia using che with check devono contenere ruolo_non_admin.
select 'utente_entita_ruolo_update: policy' as verifica,
       case
           when chk like '%ruolo_non_admin%'
           then 'OK — ruolo_non_admin presente nella with check'
           else 'ATTENZIONE — ruolo_non_admin assente'
       end as esito,
       usg as using_expr,
       chk as with_check_expr
from (
    select pg_get_expr(pol.polqual, pol.polrelid)      as usg,
           pg_get_expr(pol.polwithcheck, pol.polrelid)  as chk
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where c.relname = 'utente_entita_ruolo' and pol.polname = 'utente_entita_ruolo_update'
) t;

-- ---------------------------------------------------------------- 5. ruolo_non_admin: esistenza e grants
-- Deve esistere in public, essere SECURITY DEFINER, e non essere eseguibile da anon/PUBLIC.
select 'ruolo_non_admin: esistenza e acl' as verifica,
       case
           when p.prosecdef = true
                and (p.proacl is null or array_to_string(p.proacl,'|') not like '%anon%')
           then 'OK — SECURITY DEFINER, anon non in ACL'
           else 'ATTENZIONE — non e'' SECURITY DEFINER o anon in ACL'
       end as esito,
       p.prosecdef as security_definer,
       array_to_string(p.proacl,'|') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'ruolo_non_admin';

-- ---------------------------------------------------------------- 6. Test funzionale: ADMIN non assegnabile da admin non-super
-- Simula il controllo della policy per un utente non-superadmin che tenta
-- di inserire una riga con ruolo ADMIN.
-- Risultato atteso: la colonna "ammesso" deve essere FALSE per ADMIN
-- e TRUE per CONDOMINO e PORTIERE.
select
    rp.codice,
    public.ruolo_non_admin(rp.id) as ruolo_non_admin_restituisce_true,
    case
        when rp.codice = 'ADMIN' and not public.ruolo_non_admin(rp.id)
        then 'OK — ADMIN bloccato dalla policy (ruolo_non_admin = false)'
        when rp.codice != 'ADMIN' and public.ruolo_non_admin(rp.id)
        then 'OK — ' || rp.codice || ' permesso dalla policy (ruolo_non_admin = true)'
        else 'ATTENZIONE — risultato inatteso'
    end as esito
from public.ruoli_piattaforma rp
order by rp.codice;
