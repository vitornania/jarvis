#!/bin/zsh
set -eu
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset GEMINI_API_KEY GOOGLE_API_KEY OPENAI_API_KEY CODEX_API_KEY ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CURSOR_API_KEY CURSOR_AUTH_TOKEN
echo "JARVIS · Gemini via Antigravity CLI (agy)"
echo "Sign in with your Google account (free / subscription). No paid API key required."
echo ""
if ! command -v agy >/dev/null 2>&1; then
  echo "agy not found. Installing Antigravity CLI…"
  brew install --cask antigravity-cli || curl -fsSL https://antigravity.google/cli/install.sh | bash
fi
agy --version || true
echo ""
echo "Launching agy. Choose Google OAuth if prompted, then quit with /quit when done."
exec agy
