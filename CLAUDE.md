# Progetto "Tu" - Piattaforma Condominiale

Stack: React Native (Expo, Web e Mobile), Supabase, Vercel.

## Piattaforma
- Un'unica codebase React Native (Expo) che gira su iOS, Android e Web.
- Mobile-first e responsive: ogni schermata deve funzionare su smartphone,
  tablet e desktop con lo stesso codice, seguendo i breakpoint della sez. 16
  di DESIGN_SYSTEM.md.
- Nessun CSS o HTML web-only: usa solo componenti e StyleSheet di React Native
  (compatibili con react-native-web).
- I token CSS della sez. 21.1 non esistono in React Native: i valori vivono
  in un file tokens.ts (packages/ui/src/tokens.ts, package condiviso
  del monorepo) e tutto lo stile li importa da lì.
- Layout desktop: sidebar navy. Layout smartphone: barra in basso.
- Ogni componente e ogni schermata deve funzionare su web, Android e iOS.
  Nessun codice web-only (HTML, CSS, div) in packages/ui e nell'app
  condomino-mobile.
- Differenze tra web, Android e iOS si gestiscono con layout responsive
  (useBreakpoint) e, solo se necessario, file .web.tsx / .native.tsx o
  Platform.select. Mai due versioni separate dello stesso componente.

## Prima di ogni lavoro sulla UI
Leggi sempre per intero DESIGN_SYSTEM.md. Ha priorità assoluta su qualsiasi
scelta estetica.

## Priorità
DESIGN_SYSTEM.md ha priorità assoluta sulle scelte estetiche della skill
frontend-design: usala solo per la cura dei dettagli, non per cambiare stile.

## Promemoria operativi
- Token solo da packages/ui/src/tokens.ts, icone solo Lucide.
- Mai dati dimostrativi nella UI: dati reali da Supabase (solo progetto di sviluppo).
- Dopo ogni modifica UI: verifica con Playwright a 1440, 820 e 390px
  e applica la checklist della sezione 23.
- Non eseguire mai comandi git non richiesti (stash, reset, checkout, clean,
  restore): se serve confrontare o ripristinare file, usa copie o chiedi prima.
- Il PRD è in docs/PRD.md: leggilo solo quando il task lo richiede.
- Riferimento visivo della Home: docs/mockup-home.png