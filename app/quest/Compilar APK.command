#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null; then
  print 'Falta Node.js.'
  read '?Presioná Enter para cerrar.'
  exit 1
fi
node scripts/quest.mjs build
result=$?
read '?Presioná Enter para cerrar.'
exit $result
