#!/usr/bin/env bash
# Deterministic Phase-4 gatekeeper (Unix). Exit non-zero on failure. Zero LLM tokens.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Gatekeeper stack: node (pnpm workspace)"

echo "==> pnpm lint (biome check)"
pnpm lint

echo "==> pnpm typecheck"
pnpm typecheck

echo "==> pnpm test"
pnpm test

if command -v semgrep >/dev/null 2>&1; then
  echo "==> semgrep"
  semgrep scan --config auto --error
else
  echo "WARN: semgrep not installed (accepted for local harness)"
fi

echo "==> Gatekeeper passed"
