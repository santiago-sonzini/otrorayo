#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null; then
  print 'Falta Node.js. Instalalo para ejecutar el controlador y el instalador.'
  read '?Presioná Enter para cerrar.'
  exit 1
fi
node scripts/install-interactive.mjs
