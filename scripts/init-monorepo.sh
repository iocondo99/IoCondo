#!/usr/bin/env bash
# Crea l'alberatura fisica del monorepo (idempotente). Uso:  bash scripts/init-monorepo.sh
set -euo pipefail
mkdir -p apps/admin-web/src apps/condomino-mobile/src \
         packages/supabase-client/src packages/shared-types/src \
         supabase/functions scripts
npm install
echo "Monorepo pronto. Prossimi passi: npm run gen:types, npm run typecheck"
