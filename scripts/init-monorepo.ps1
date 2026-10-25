# Crea l'alberatura fisica del monorepo (idempotente). Uso:  pwsh scripts/init-monorepo.ps1
$dirs = @(
  'apps/admin-web/src',
  'apps/condomino-mobile/src',
  'packages/supabase-client/src',
  'packages/shared-types/src',
  'supabase/functions',
  'scripts'
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
npm install
Write-Host 'Monorepo pronto. Prossimi passi: npm run gen:types, npm run typecheck'
