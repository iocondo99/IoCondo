-- =============================================================================
-- 10_verifica.sql
-- Script di verifica IN SOLA LETTURA post-migrazione per 10_contabilita_schema_modello_obiettivo.sql
-- Copertura test: T18 (conversione centesimi senza discrepanze), T19 (log migrazione),
--                 T20/T21 (coesistenza colonne numeric e centesimi), T22 (zero righe orfane).
-- =============================================================================

-- ---------------------------------------------------------------- 1. Esito registrato in migrazioni_contabilita_log (RC-O12, T19)
select
    '1. Registro migrazione (T19)' as verifica,
    case
        when stato = 'COMPLETATA'
             and conteggi_prima = conteggi_dopo
             and somme_prima = somme_dopo
             and righe_orfane = 0
        then 'OK — migrazione COMPLETATA con conteggi e somme identici e 0 righe orfane'
        else 'ATTENZIONE — stato o quadrature non conformi'
    end as esito,
    stato,
    righe_orfane,
    conteggi_prima,
    conteggi_dopo,
    somme_prima,
    somme_dopo,
    eseguita_at
from public.migrazioni_contabilita_log
where codice_migrazione = '10_contabilita_schema_modello_obiettivo'
order by eseguita_at desc
limit 1;

-- ---------------------------------------------------------------- 2. Esistenza delle 15 nuove tabelle e RLS attiva (RC-O2, RC-M4)
with tabelle_attese(nome) as (
    values
        ('migrazioni_contabilita_log'),
        ('soggetti_contabili'),
        ('assegnazioni_amministratore'),
        ('voci_spesa_catalogo'),
        ('fondi'),
        ('movimenti_fondo'),
        ('gestioni_esercizio'),
        ('preventivi'),
        ('preventivi_voci'),
        ('riparti_spese'),
        ('letture_contatori'),
        ('bollettini'),
        ('bollettini_righe'),
        ('scadenziario_recupero_crediti'),
        ('conguagli_unita')
)
select
    '2. Nuove tabelle e RLS: ' || ta.nome as verifica,
    case
        when c.oid is not null and c.relrowsecurity = true
        then 'OK — tabella presente e RLS attiva'
        when c.oid is not null and c.relrowsecurity = false
        then 'ATTENZIONE — tabella presente ma RLS DISATTIVATA'
        else 'ERRORE — tabella mancante'
    end as esito
from tabelle_attese ta
left join pg_class c on c.relname = ta.nome
  and c.relnamespace = (select oid from pg_namespace where nspname = 'public')
order by ta.nome;

-- ---------------------------------------------------------------- 3. Verifica conversione importi in centesimi per tabella (T18, T21)
with controlli_somme as (
    select
        'movimenti_contabili.importo' as campo,
        count(*) as n_righe,
        coalesce(sum(round(importo * 100)::bigint), 0) as somma_da_numeric_cents,
        coalesce(sum(importo_centesimi), 0) as somma_colonna_cents,
        count(*) filter (where importo_centesimi <> round(importo * 100)::bigint) as righe_disallineate
    from public.movimenti_contabili
    union all
    select
        'rate_dettaglio.importo_dovuto',
        count(*),
        coalesce(sum(round(importo_dovuto * 100)::bigint), 0),
        coalesce(sum(importo_dovuto_centesimi), 0),
        count(*) filter (where importo_dovuto_centesimi <> round(importo_dovuto * 100)::bigint)
    from public.rate_dettaglio
    union all
    select
        'rate_dettaglio.importo_pagato',
        count(*),
        coalesce(sum(round(importo_pagato * 100)::bigint), 0),
        coalesce(sum(importo_pagato_centesimi), 0),
        count(*) filter (where importo_pagato_centesimi <> round(importo_pagato * 100)::bigint)
    from public.rate_dettaglio
    union all
    select
        'saldi_pregressi.importo',
        count(*),
        coalesce(sum(round(importo * 100)::bigint), 0),
        coalesce(sum(importo_centesimi), 0),
        count(*) filter (where importo_centesimi <> round(importo * 100)::bigint)
    from public.saldi_pregressi
    union all
    select
        'pagamenti_rate.importo',
        count(*),
        coalesce(sum(round(importo * 100)::bigint), 0),
        coalesce(sum(importo_centesimi), 0),
        count(*) filter (where importo_centesimi <> round(importo * 100)::bigint)
    from public.pagamenti_rate
    union all
    select
        'transazioni_bancarie.importo',
        count(*),
        coalesce(sum(round(importo * 100)::bigint), 0),
        coalesce(sum(importo_centesimi), 0),
        count(*) filter (where importo_centesimi <> round(importo * 100)::bigint)
    from public.transazioni_bancarie
    union all
    select
        'riconciliazioni_log.importo_assegnato',
        count(*),
        coalesce(sum(round(coalesce(importo_assegnato, 0) * 100)::bigint), 0),
        coalesce(sum(coalesce(importo_assegnato_centesimi, 0)), 0),
        count(*) filter (where importo_assegnato is not null and importo_assegnato_centesimi <> round(importo_assegnato * 100)::bigint)
    from public.riconciliazioni_log
)
select
    '3. Parita'' centesimi (T18): ' || campo as verifica,
    case
        when somma_da_numeric_cents = somma_colonna_cents and righe_disallineate = 0
        then 'OK — 0 discrepanze (' || n_righe || ' righe, ' || somma_colonna_cents || ' cent)'
        else 'ERRORE — rilevate ' || righe_disallineate || ' righe disallineate'
    end as esito,
    n_righe,
    somma_da_numeric_cents,
    somma_colonna_cents,
    righe_disallineate
from controlli_somme;

-- ---------------------------------------------------------------- 4. Quadratura centesimi per singolo condominio (T18)
select
    '4. Quadratura condominio (T18): ' || c.nome as verifica,
    case
        when coalesce(m.diff_mov, 0) = 0
             and coalesce(r.diff_dov, 0) = 0
             and coalesce(r.diff_pag, 0) = 0
             and coalesce(p.diff_pag_rate, 0) = 0
        then 'OK — quadratura perfetta sul condominio'
        else 'ERRORE — discrepanza rilevata sul condominio'
    end as esito,
    coalesce(m.tot_mov_cents, 0) as movimenti_centesimi,
    coalesce(r.tot_dov_cents, 0) as rate_dovuto_centesimi,
    coalesce(r.tot_pag_cents, 0) as rate_pagato_centesimi,
    coalesce(p.tot_pag_rate_cents, 0) as pagamenti_rate_centesimi
from public.condomini c
left join (
    select condominio_id,
           sum(importo_centesimi) as tot_mov_cents,
           sum(importo_centesimi - round(importo * 100)::bigint) as diff_mov
      from public.movimenti_contabili
     group by condominio_id
) m on m.condominio_id = c.id
left join (
    select condominio_id,
           sum(importo_dovuto_centesimi) as tot_dov_cents,
           sum(importo_pagato_centesimi) as tot_pag_cents,
           sum(importo_dovuto_centesimi - round(importo_dovuto * 100)::bigint) as diff_dov,
           sum(importo_pagato_centesimi - round(importo_pagato * 100)::bigint) as diff_pag
      from public.rate_dettaglio
     group by condominio_id
) r on r.condominio_id = c.id
left join (
    select condominio_id,
           sum(importo_centesimi) as tot_pag_rate_cents,
           sum(importo_centesimi - round(importo * 100)::bigint) as diff_pag_rate
      from public.pagamenti_rate
     group by condominio_id
) p on p.condominio_id = c.id
order by c.nome;

-- ---------------------------------------------------------------- 5. Verifica zero righe orfane e isolamento condominio (RC-O4, T22)
with orfane as (
    select 'anagrafiche_unita' as tabella, count(*) as n_orfane
      from public.anagrafiche_unita a
     where a.condominio_id is null or not exists (select 1 from public.condomini c where c.id = a.condominio_id)
    union all
    select 'esercizi_contabili', count(*)
      from public.esercizi_contabili e
     where e.condominio_id is null or not exists (select 1 from public.condomini c where c.id = e.condominio_id)
    union all
    select 'tabelle_millesimali', count(*)
      from public.tabelle_millesimali t
     where t.condominio_id is null or not exists (select 1 from public.condomini c where c.id = t.condominio_id)
    union all
    select 'quote_millesimali', count(*)
      from public.quote_millesimali q
     where q.condominio_id is null
        or not exists (select 1 from public.tabelle_millesimali t where t.id = q.tabella_id and t.condominio_id = q.condominio_id)
    union all
    select 'movimenti_contabili', count(*)
      from public.movimenti_contabili m
     where m.condominio_id is null
        or not exists (select 1 from public.esercizi_contabili e where e.id = m.esercizio_id and e.condominio_id = m.condominio_id)
    union all
    select 'rate_testata', count(*)
      from public.rate_testata rt
     where rt.condominio_id is null
        or not exists (select 1 from public.esercizi_contabili e where e.id = rt.esercizio_id and e.condominio_id = rt.condominio_id)
    union all
    select 'rate_dettaglio', count(*)
      from public.rate_dettaglio rd
     where rd.condominio_id is null
        or not exists (select 1 from public.rate_testata rt where rt.id = rd.rata_testata_id and rt.condominio_id = rd.condominio_id)
    union all
    select 'saldi_pregressi', count(*)
      from public.saldi_pregressi sp
     where sp.condominio_id is null
        or not exists (select 1 from public.esercizi_contabili e where e.id = sp.esercizio_id and e.condominio_id = sp.condominio_id)
    union all
    select 'pagamenti_rate', count(*)
      from public.pagamenti_rate pr
     where pr.condominio_id is null
        or not exists (select 1 from public.rate_dettaglio rd where rd.id = pr.rata_dettaglio_id and rd.condominio_id = pr.condominio_id)
    union all
    select 'riconciliazioni_log', count(*)
      from public.riconciliazioni_log rl
     where rl.condominio_id is null
        or not exists (select 1 from public.transazioni_bancarie tb where tb.id = rl.transazione_id and tb.condominio_id = rl.condominio_id)
)
select
    '5. Righe orfane / coerenza tenant (T22): ' || tabella as verifica,
    case
        when n_orfane = 0 then 'OK — 0 righe orfane'
        else 'ERRORE — ' || n_orfane || ' righe orfane o incoerenti col padre'
    end as esito,
    n_orfane
from orfane
order by tabella;

-- ---------------------------------------------------------------- 6. Verifica popolamento catalogo 10 voci spesa e assegnazioni admin (RC-C2, RC-A13)
select
    '6. Catalogo voci spesa e assegnazione admin: ' || c.nome as verifica,
    case
        when coalesce(v.n_voci, 0) >= 10 and coalesce(a.n_admin_attivi, 0) = 1
        then 'OK — ' || v.n_voci || ' voci a catalogo e 1 amministratore attivo'
        else 'ATTENZIONE — voci: ' || coalesce(v.n_voci, 0) || ', admin attivi: ' || coalesce(a.n_admin_attivi, 0)
    end as esito,
    coalesce(v.n_voci, 0) as voci_catalogo,
    coalesce(a.n_admin_attivi, 0) as admin_attivi
from public.condomini c
left join (
    select condominio_id, count(*) as n_voci
      from public.voci_spesa_catalogo
     group by condominio_id
) v on v.condominio_id = c.id
left join (
    select condominio_id, count(*) as n_admin_attivi
      from public.assegnazioni_amministratore
     where ruolo_incarico = 'AMMINISTRATORE' and is_attivo = true and data_cessazione is null
     group by condominio_id
) a on a.condominio_id = c.id
order by c.nome;
