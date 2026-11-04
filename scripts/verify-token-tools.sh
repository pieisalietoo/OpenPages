#!/usr/bin/env bash
# Verify token-control / context-hygiene tooling. Run as TASKS.md item 1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0
warn() { echo "WARN: $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "OK: $*"; }

echo "==> Token-tools verification ($ROOT)"

if [[ -f .cursorignore ]]; then ok ".cursorignore present"
else fail ".cursorignore missing"; fi

for pat in node_modules .venv dist build coverage "*.lock" .env artifacts repomap; do
  if [[ -f .cursorignore ]] && grep -qF "${pat//\*/}" .cursorignore 2>/dev/null || \
     { [[ -f .cursorignore ]] && grep -qE "$(echo "$pat" | sed 's/\*/.*/g')" .cursorignore 2>/dev/null; }; then
    ok ".cursorignore mentions $pat"
  else
    warn ".cursorignore may not cover $pat (check manually)"
  fi
done

if [[ -f .gitignore ]] && grep -q "repomap" .gitignore; then ok ".gitignore mentions repomap/"
else fail ".gitignore missing repomap/"; fi

if [[ -f repomix.config.json ]]; then ok "repomix.config.json present"
else fail "repomix.config.json missing"; fi

if [[ -f .cursor/rules/tdd-pipeline.mdc ]]; then ok "tdd-pipeline.mdc"
else fail "missing .cursor/rules/tdd-pipeline.mdc"; fi
if [[ -f .cursor/rules/minimal-code.mdc ]]; then ok "minimal-code.mdc"
else fail "missing .cursor/rules/minimal-code.mdc"; fi
if [[ -d tdd-evidence ]]; then ok "tdd-evidence/ present"
else fail "missing tdd-evidence/ (RED/GREEN evidence logs)"; fi

if command -v rg >/dev/null 2>&1; then ok "ripgrep (rg)"
else fail "ripgrep (rg) not in PATH"; fi

if command -v repomix >/dev/null 2>&1 || npx --yes repomix --version >/dev/null 2>&1; then
  ok "repomix available"
  mkdir -p repomap
  if command -v repomix >/dev/null 2>&1; then
    repomix >/dev/null 2>&1 && ok "repomix smoke -> repomap/repo-map.md" || warn "repomix smoke failed (empty repo is OK)"
  else
    warn "repomix via npx only; prefer global install for agents"
  fi
else
  fail "repomix not installed (npm i -g repomix)"
fi

if [[ -f docs/agentic-tdd-workflow.md && -f docs/tooling-catalog.md && -f docs/fiscal-and-legal.md ]]; then
  ok "workflow + tooling + fiscal docs present"
else
  fail "missing one of docs/agentic-tdd-workflow.md, tooling-catalog.md, fiscal-and-legal.md"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "==> FAILED - fix before architecture / MVP work"
  exit 1
fi
echo "==> PASSED"
