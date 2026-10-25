# Spec-Driven Agentic TDD Workflow

Target audience: LLMs / Cursor agents / humans bootstrapping a ProjectKeeper-spawned repo.

Goal: maximize agent autonomy while keeping code quality, maintainability, and token use under control. Development is **exclusively TDD**.

Canonical name: **Spec-Driven Red-Green-Refactor-Prune** (Evaluator-Optimizer loop with deterministic gates).

---

## 1. Architecture

Human input: (1) a clear spec / acceptance criteria, (2) whether to auto-advance the plan or pause between steps, (3) optionally confirm **commit message wording** at step close (commit itself is mandatory — see §3) or final PR review.

Agents do not run as one open-ended conversation. They run as constrained phases, coordinated by local CLI checks that cost **zero LLM tokens**.

A **plan step** is one item from the development plan / `TASKS.md`. Within a step, several RED→GREEN→PRUNE→gatekeeper micro-cycles may run.

```
                  [ Requirement / Spec / plan step ]
                              │
                              ▼
                   ┌─────────────────────┐
                   │    1. Agent RED     │ ◄── writes tests only
                   └─────────────────────┘     append tdd-evidence/red.txt
                              │
                    Fails     │ Passes immediately
                    (OK)      │ (Alarm: invalid / tautological test)
                              ├──────────────────────┐
                              ▼                      ▼
                   ┌─────────────────────┐┌─────────────────────┐
                   │   2. Agent GREEN    ││ Reject & rewrite    │
                   └─────────────────────┘│ tests (back to RED) │
                              │           └─────────────────────┘
               Tests green    │  append tdd-evidence/green.txt
                              ▼
                   ┌─────────────────────┐
                   │  3. Agent PRUNE &   │ ◄── minimize code,
                   │      REFACTOR       │     keep tests green
                   └─────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │   4. Deterministic  │ ◄── lint, format,
                   │      Gatekeeper     │     types, SAST, tests
                   └─────────────────────┘
                              │
                      Pass    │ Fail → feedback to GREEN / PRUNE
                              ▼
         [ Step boundary: commit previous step → reset evidence logs → next step ]
```

---

## 2. Phase contracts

### Phase 1 — Agent RED (Test Author)

- **Job:** Write unit/integration tests from the spec only.
- **Hard rule:** No production implementation. Do not create production modules “to make imports work” beyond the minimal failing stubs required by the language (prefer failing imports over fake implementations).
- **Validation:** Run the new tests immediately.
  - Fail → proceed to GREEN.
  - Pass with no new production code → **stop**. Tests are empty, tautological, or wrongly targeting existing behavior.
- **Evidence:** Append the full test command stdout+stderr to `tdd-evidence/red.txt` (see § Evidence logs).

### Phase 2 — Agent GREEN (Minimal Implementation)

- **Job:** Smallest production change that makes the failing tests pass.
- **Hard rule:** YAGNI. No speculative abstractions, optional “future” parameters, or architecture for tomorrow.
- **Context:** Prefer **failing test terminal output** + relevant signatures over dumping the whole repo into the prompt.
- **Evidence:** Append the full test command stdout+stderr to `tdd-evidence/green.txt`.

### Phase 3 — Agent PRUNE & REFACTOR (Optimizer)

- **Job:** Shrink and clarify GREEN code; **do not** add features.
- **Required actions:** DRY, remove dead branches/temps, prefer stdlib, keep readability, keep tests green.
- **Exit:** LOC and complexity should not grow without a readability win.

### Phase 4 — Deterministic Gatekeeper (zero-token)

- **Job:** Local CLI: format, lint, typecheck, tests, SAST (and optionally mutation testing on a schedule).
- **On failure:** Feed structured tool output back to GREEN or PRUNE. Do not start a free-form “review everything” LLM pass for style/security that tools already cover.
- Gatekeeper output stays out of the RED/GREEN evidence files.

---

## 3. Plan-step boundaries & commits

**Hard rule:** every completed plan step (after gatekeeper pass) **must** end in a git commit. Ending a development session / slice with unfinished-but-done work also **must** commit. Committing is **not optional**. Interactive mode may confirm **message wording** only — never *whether* to commit.

### Closing a completed step

1. Gatekeeper must pass.
2. Create a commit whose message describes **this completed step** (step *N*), not the next one.
3. Include that step’s `tdd-evidence/red.txt` and `green.txt` in the commit.
4. Only then reset the evidence logs (see below).

### Before starting a new step

1. Check `git status`.
2. If the working tree is **not clean** (previous step not closed):
   - **Always** create the closing commit for the previous step (message = previous step).
   - **Interactive / human-paced:** you may ask the human to **confirm or edit the commit message**, then commit. Do not start the new step until that commit exists.
   - **Auto-advance:** commit yourself with an appropriate message (no “skip commit” path), then start the next step.
3. If the tree is already clean, start the step.

### Commit message (inter-step / end of slice)

The commit that closes step *N* must describe **step N** — the work just completed — not the step about to begin.

Example: before starting “Step 3: auth”, the commit message refers to “Step 2: …”.

At the **end of a development session**, if the latest step is complete and gatekeeper is green, commit even if no next step is started yet.

### After that commit

Only then reset the TDD evidence log files (see below) so the next step starts with empty logs. Do **not** reset before the commit: the commit must include exactly the RED/GREEN test output produced during that step’s development.

---

## 4. TDD evidence logs

Tracked paths (do **not** gitignore; use `.txt` so they are not caught by `*.log` rules):

| File | When to write |
|------|----------------|
| `tdd-evidence/red.txt` | After every RED validation run (expected fail, or rewrite loop) |
| `tdd-evidence/green.txt` | After every GREEN validation run (expected pass) |

Seed the folder with `tdd-evidence/.gitkeep` at spawn.

### Append within a step

If a step has multiple RED or GREEN cycles, **append** to the same file. Separate cycles with a clear banner:

```
======== RED cycle 2 — 2026-09-20T11:00:00Z — <short spec / step id> ========
<full terminal test output>
```

Same pattern for GREEN (`GREEN cycle N`). Cycle counters are per-step and restart after reset.

### Reset between steps

- Reset both files to empty (or delete + recreate) **only after** the inter-step commit that closes the previous step.
- Consequence: each step’s commit contains only that step’s RED/GREEN evidence.

---

## 5. Token & context control

| Technique | Purpose |
|-----------|---------|
| **Repo map (Repomix / AST map)** | Send signatures and structure, not full sources, when exploring. Honor `repomix.config.json`; write under `repomap/` (gitignored). Prefer subtree path args over whole-repo dumps. |
| **Model tiering** | Cheap/fast models for RED / mechanical fixes; stronger models for GREEN / hard refactor |
| **LSP / diagnostics via tools** | Feed line-level errors; do not re-read whole files to rediscover them |
| **`.cursorignore`** | Exclude locks, `node_modules`, venvs, build, coverage, logs, `repomap/` from agent context |
| **Terminal-first feedback** | GREEN reads test/linter output, not the entire tree |

Human oversight is intermittent: trust the loop + gatekeeper; intervene on spec ambiguity, failed RED validation, commit-message wording, or gatekeeper loops that do not converge.

---

## 6. Quality bar (non-negotiable)

- Every production change traces to a failing test first.
- Prefer fewer lines and fewer abstractions over “enterprise” scaffolding.
- Security and style are primarily **tool-enforced**, then agent-fixed from tool output.
- Mutation testing (Stryker / mutmut) is the backstop against weak RED tests; run on CI or periodically, not necessarily every micro-cycle.

---

## 7. Cursor operating model

1. Copy ProjectKeeper templates into the repo (rules, ignore, gatekeeper script, this doc, `tdd-evidence/`).
2. Install tools listed in `docs/tooling-catalog.md` (or the copy under this repo).
3. Implement plan steps as: (mandatory commit of previous dirty step if any) → one or more RED→GREEN→PRUNE→gatekeeper cycles with evidence append → gatekeeper pass → **mandatory commit** of this step.
4. Prefer Agent mode with terminal tool use for `test` / `lint` / `typecheck`.
5. At step boundaries: commit previous step (message about that step), then reset `tdd-evidence/red.txt` and `tdd-evidence/green.txt`.
6. Within a step, append RED/GREEN test output after each cycle; do not wipe logs mid-step.

Rule zero for agents:

> Never write production code unless a failing test already exists for that behavior.

---

## 8. Expected outcomes

1. **Less human intervention** — spec in, validated commit out (every closed step is committed; auto-advance does not wait on “whether to commit”).
2. **Maintainable minimal code** — GREEN + PRUNE + fast linters.
3. **Bounded token spend** — repo maps, ignore rules, model tiering, deterministic gates.
4. **Higher security baseline** — Semgrep + typecheck before LLM “security review”.
5. **Auditable TDD** — each step commit carries that step’s RED/GREEN evidence only.

---

## Related ProjectKeeper artifacts

| Artifact | Role |
|----------|------|
| `docs/tooling-catalog.md` | MCP servers, extensions, CLIs, scripts to install |
| `templates/repo-bootstrap-checklist.md` | Spawn checklist (copies these docs into the new repo) |
| `templates/cursor/` | Seed `.cursor/rules` + `.cursorignore` |
| `templates/tdd-evidence/` | Seed folder for RED/GREEN evidence logs |
| `templates/scripts/gatekeeper.*` | Local zero-token verification entrypoint |
| `fiscal-and-legal.md` | Compliance seed (orthogonal but always copied) |
