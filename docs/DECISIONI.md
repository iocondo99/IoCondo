# Decisioni

- admin-web da portare su Expo web con @iocondo/ui, decisione dopo Login e Home del condòmino.
- Servizi duplicati tra admin-web e app mobile da unificare in un package condiviso.
- Expo Go per SDK 58 su iPhone è atteso sugli store; l'account Apple Developer si valuta alla pubblicazione. Nel frattempo si prova su web (Safari) e su Android con Expo Go.
- Aggiornamento da Expo SDK 52 a SDK 58 (React Native 0.88, React 19.3, expo-router 58). Motivo: Expo Go supporta solo l'SDK più recente e l'SDK 52 non era più apribile. Percorso scelto: progetto ricreato sul template SDK 58 e codice spostato (l'app era ancora senza schermate), invece dei sei salti incrementali.
- admin-web portato a Next 15.5 e React 19.3 (con @types/react 19) per avere un'unica versione di React nel monorepo, requisito dell'SDK 58. Nessuna modifica funzionale.
- Da valutare più avanti: TypeScript 6 (expo-doctor lo indica per l'SDK 58; oggi il repo è su 5.6) e @supabase/ssr oltre la 0.5.2 (dalla 0.10 setAll riceve gli header anti-cache per le risposte con cookie di sessione).
