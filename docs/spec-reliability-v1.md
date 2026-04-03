# Reliability v1 RFC

Status: Draft  
Scope: `opencode-gladio`  
Goal: Improve reliability, visibility, and safe failure behavior without diluting Gladio's opinionated identity.

## Summary

This RFC proposes five reliability-focused additions to `opencode-gladio`:

1. Versioned config/schema + migration discipline
2. Effective config visibility
3. Doctor / healthcheck command
4. Graceful degradation for optional components
5. Narrow fallback chains for coordinator/verifier

These changes are intentionally limited. The goal is not to generalize Gladio into a broad orchestration framework, but to reduce surprise, make failures diagnosable, and keep the core harness stable when optional pieces break.

## Motivation

Recent failures showed recurring reliability gaps:

- config drift and schema mismatch can stay partially invisible
- installer/runtime state is not always easy to inspect after merge
- optional vendor/plugin failures can cascade into broken startup behavior
- model failure behavior is implicit rather than explicit
- support/debugging currently requires reading source and logs manually

Gladio already has the right primitives:

- merged harness config
- installer-managed wiring
- hook-heavy runtime
- managed MCP/vendor components

What is missing is a single resolved runtime state model and a set of user-facing commands around it.

## Product principles

- Gladio remains **opinionated**
- Gladio remains **GPT-first**
- Core behavior must be stable even when optional integrations fail
- Visibility comes before automation
- Deterministic fallbacks are preferred over wide dynamic routing

## Non-goals

This RFC does **not** include:

- full multi-provider orchestration
- broad generic agent fallback for all workers
- automatic repair-on-boot
- third-party plugin marketplace management
- tmux/multiplexer-style UX features
- taking ownership of full `opencode.json` schema

## Shared design decision: resolved runtime state

All five features must use one shared internal model:

- merged config after defaults/user/project resolution
- migrated config shape
- source attribution per important field
- optional component readiness status
- fallback status
- disabled reasons and warnings

This resolved runtime state becomes the single source of truth for:

- runtime boot decisions
- `config show`
- `doctor`
- fallback visibility
- degradation decisions

Without this shared model, drift will reappear.

---

## Feature 1 — Versioned config/schema + migration discipline

### Goal

Reduce config drift and make breaking config evolution explicit.

### Proposed surface

Add a version field to harness config:

```jsonc
{
  "schema_version": 1
}
```

New CLI command:

```bash
opencode-gladio config migrate
```

### Behavior

Config load pipeline:

1. Parse file
2. Detect version
3. Apply in-memory migrations
4. Validate against current schema
5. Produce resolved config + warnings

### Rules

- Runtime load performs **in-memory migration only**
- File rewrite happens only through explicit commands:
  - `opencode-gladio init`
  - `opencode-gladio config migrate`
  - future optional `install --migrate`
- Every future breaking config change requires:
  - schema version bump
  - migration step
  - migration tests

### Acceptance criteria

- Older config files still load when migratable
- Migration steps are idempotent
- Migration warnings are visible in `doctor`
- New sample config always writes the current version

---

## Feature 2 — Effective config visibility

### Goal

Let the user see the actual active harness state after merge and normalization.

### Proposed CLI

```bash
opencode-gladio config show
opencode-gladio config show --json
opencode-gladio config show --sources
```

### Output requirements

Show:

- effective merged harness config
- source per key where meaningful:
  - `default`
  - `user`
  - `project`
  - `env`
  - `runtime-disabled`
- masked secrets
- resolved status of:
  - hooks
  - MCPs
  - optional components
  - fallback candidates
  - selected coordinator/verifier models

### Notes

- `print-config` is static today; after this RFC it should either be deprecated or aligned with `config show`
- visibility must reflect post-migration, post-normalization state, not raw file contents

### Acceptance criteria

- The user can tell which layer set a value
- Disabled components display a reason
- Effective output matches actual runtime behavior
- Secrets never print in plain text

---

## Feature 3 — Doctor / healthcheck

### Goal

Catch startup, install, drift, and optional component issues before they become runtime failures.

### Proposed CLI

```bash
opencode-gladio doctor
opencode-gladio doctor --json
opencode-gladio doctor --strict
```

### Output sections

1. Config
2. Install artifacts
3. Managed plugins
4. Vendor components
5. MCP readiness
6. Agent/fallback status
7. Drift summary

### Status model

- `PASS`
- `WARN`
- `FAIL`

Exit code:

- default: non-zero on `FAIL`
- `--strict`: non-zero on `WARN` or `FAIL`

### What doctor checks

#### Config
- parse errors
- invalid sections ignored during partial load
- schema version mismatch
- migration pending

#### Install artifacts
- managed paths exist
- harness package is present
- expected files are available

#### Managed plugins
- expected managed entries exist in OpenCode config
- vendored background-agents path exists
- managed plugin references resolve cleanly

#### MCP readiness
- enabled local MCP folders exist
- required dependencies are present when needed
- optional MCPs that cannot boot are marked degraded

#### Agent/fallback state
- coordinator/verifier model selection resolves
- fallback chain is valid

### Non-goals

- no live provider/network smoke testing in v1
- no mutation by default; `doctor` is read-only

### Acceptance criteria

- Doctor can identify startup-risk issues like broken managed plugin state
- JSON output is stable enough for scripts/CI
- The user can diagnose the most common failure classes without reading source

---

## Feature 4 — Graceful degradation

### Goal

Optional MCP/vendor/plugin failures should not take down the entire harness.

### Proposed config surface

```jsonc
{
  "runtime": {
    "degrade_optional_failures": true
  },
  "optional_components": {
    "background_agents": "auto",
    "shell_strategy": "auto"
  }
}
```

Allowed values for optional components:

- `auto`
- `off`

### Core vs optional

#### Core
- config loading
- primary Gladio agent wiring
- core hooks/commands

#### Optional
- vendored background-agents
- optional MCP integrations
- shell strategy helper wiring

### Behavior

- Optional components get readiness-checked before activation
- If readiness fails:
  - component is not activated
  - degraded reason is recorded in resolved runtime state
  - warning is surfaced once, not spammed repeatedly
- Installer should avoid writing known-broken optional pieces into active config when detectably invalid

### Important limit

Some sibling plugin load failures happen inside OpenCode before Gladio can react. For those cases, installer preflight and doctor coverage are part of the graceful degradation strategy.

### Acceptance criteria

- Broken optional components no longer imply full harness failure by default
- Degraded state is visible in both `doctor` and `config show`
- Core Gladio workflow still boots when optional integrations are unavailable

---

## Feature 5 — Narrow fallback chains

### Goal

Provide deterministic, low-complexity fallback only for the most critical roles.

### Scope

V1 supports fallback only for:

- `polat` (coordinator)
- `halit` (verifier)

### Proposed config surface

```jsonc
{
  "fallbacks": {
    "coordinator": [
      { "model": "openai/gpt-5.4", "variant": "high" }
    ],
    "verifier": [
      { "model": "openai/gpt-5.4", "variant": "none" }
    ]
  }
}
```

### Default behavior

- Coordinator:
  - `openai/gpt-5.4 / xhigh`
  - fallback: `openai/gpt-5.4 / high`
- Verifier:
  - `openai/gpt-5.4-mini / none`
  - fallback: `openai/gpt-5.4 / none`

### Trigger conditions

Fallback occurs only for explicit compatibility/runtime failures such as:

- model unavailable
- unsupported model
- provider/model resolution failure

Fallback does **not** occur for subjective quality reasons.

### Acceptance criteria

- Fallback path is deterministic and visible
- Role identity stays unchanged; only model selection changes
- Active fallback appears in `doctor` and resolved config output

---

## CLI changes summary

### New commands

```bash
opencode-gladio config show
opencode-gladio config show --json
opencode-gladio config show --sources
opencode-gladio config migrate
opencode-gladio doctor
opencode-gladio doctor --json
opencode-gladio doctor --strict
```

### Existing command adjustments

- `init` writes `schema_version`
- `print-config` is deprecated or redefined as a static example command only
- `install` may later reuse doctor/preflight logic, but v1 keeps doctor read-only

---

## Recommended implementation order

### Phase 1 — Config versioning foundation

Deliver:

- `schema_version`
- migration pipeline
- shared resolved runtime state model

Why first:

- all other features depend on normalized config state

### Phase 2 — Effective config visibility

Deliver:

- `config show`
- source attribution
- masked output

Why second:

- gives immediate visibility and a foundation for support/debugging

### Phase 3 — Doctor

Deliver:

- `doctor`
- status model
- JSON output

Why third:

- uses resolved config state and visibility logic to diagnose install/runtime drift

### Phase 4 — Graceful degradation

Deliver:

- optional component readiness model
- degraded activation behavior
- status reasons surfaced in doctor/config show

Why fourth:

- depends on doctor-level visibility to stay debuggable

### Phase 5 — Narrow fallback

Deliver:

- coordinator/verifier fallback resolution
- visible fallback state

Why last:

- smallest blast radius, easiest to add once state/reporting exists

---

## Risks

- If resolved runtime state is duplicated across modules, drift returns
- If graceful degradation is too silent, failures become harder to notice
- If fallback expands beyond coordinator/verifier, complexity grows quickly
- If doctor grows too broad too early, maintenance cost rises sharply

## Open questions

1. Should `print-config` remain as a static onboarding command, or be fully replaced by `config show`?
2. Should `doctor` eventually offer optional `--fix`, or remain read-only by design?
3. Should `optional_components.background_agents` default to `auto` or to `off` on fresh installs?
4. Should migration warnings surface only in CLI commands, or also during runtime boot logs?

## Success criteria

This RFC is successful when a user can answer these questions without reading source code:

- What config is actually active?
- Which values came from defaults, user config, or project config?
- Which optional pieces are disabled, and why?
- Is the current install healthy?
- If the primary model fails, what happens next?

And when Gladio can survive common optional-component failures without collapsing its core workflow.
