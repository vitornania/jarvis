#!/bin/zsh
set -eu
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}/.."
if curl -fsS http://127.0.0.1:4318/terminal-api/status >/dev/null 2>&1; then
  open http://127.0.0.1:4318
  exit 0
fi
open http://127.0.0.1:4318
exec node dashboard/server.mjs
