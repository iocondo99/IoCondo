@echo off
echo 🚀 Avvio Agente 1: Architetto (Creazione Tabelle)...
antigravity run prompts/01_architetto_schema.md

echo 🔒 Avvio Agente 2: Sicurezza (Policy RLS)...
antigravity run prompts/02_sicurezza_rls.md

echo ⚙️ Avvio Agente 3: Backend (Trigger e Funzioni)...
antigravity run prompts/03_backend_triggers.md

echo 🧪 Avvio Agente 4: Data Engineer (Dati fittizi)...
antigravity run prompts/04_mock_data.md

echo ✅ Finito! Tutti gli script SQL sono pronti in supabase/migrations/
pause