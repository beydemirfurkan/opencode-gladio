# Agent Matrix

## Coordinator

| Agent | Role | Variant |
| --- | --- | --- |
| `polat` | Primary coordinator. Classifies tasks into tiers, delegates to workers, synthesizes results, manages scope. | `high` |

## Workers

| Agent | Role | Domain | Variant |
| --- | --- | --- | --- |
| `cakir` | Execution lead. Decomposes plans into discrete work packages and routes them to specialists. Read-only. | Task routing | `none` |
| `memati` | Implementer. Delivers production code for the agreed spec with minimal churn. | Core implementation | `high` |
| `abdulhey` | Researcher. Gathers docs, API references, changelogs, and rationale. Reports only, no implementation. | Research | `none` |
| `aslan-akbey` | Senior reviewer. Inspects correctness, conventions, maintainability, and performance. Read-only. | Code review | `high` |
| `iskender` | Adversarial reviewer. Hunts security issues, race conditions, data integrity risks, and misuse flows. Read-only. | Security & adversarial | `high` |
| `tuncay` | Repair specialist. Fixes verifier or reviewer failures with minimal scope. Max 2 attempts, then escalates. | Scoped repair | `high` |
| `halit` | Verifier. Runs typecheck, tests, and lint. Reports structured PASS/FAIL/SKIP. Does not fix. | Verification | `none` |
| `gullu-erhan` | UI developer. Implements frontend with browser automation and responsive checks. | UI/UX | `high` |
| `laz-ziya` | Repo scout. Fast codebase explorer for file discovery and pattern mapping. | Reconnaissance | `none` |
| `pala` | Chaos tester. Exercises edge cases, race conditions, and assumption breaches. Reports only. | Chaos & robustness | `high` |

All agents use the OpenCode default model unless overridden via config. Models and variants are fully configurable through `opencode-gladio.jsonc`.

## Workflow tiers

Polat classifies every task before routing. No user input required.

| Tier | Criteria | Pipeline |
| --- | --- | --- |
| **1 — Trivial** | Single file, narrow scope (typo, config value, small rename) | Polat → Memati |
| **2 — Standard** | New feature, bug fix, 2–5 files, no auth/DB/security risk | Polat → Çakır → Memati → Halit |
| **3 — Risky** | Auth, DB migration, public API, security-sensitive, 6+ files | Polat → Çakır → Memati → Halit → Aslan Akbey + İskender (parallel) → Tuncay (if needed) |
| **4 — Critical** | Payment, external integrations, production data migration, irreversible ops | Tier 3 + Pala. User confirmation before push/deploy. |

**Rules:**
- Default down, not up — when uncertain between tiers, use the lower one.
- Halit runs after every Tier 2+ implementation. No exceptions.
- Aslan Akbey and İskender always run in parallel (independent concerns).

## Review role boundaries

| Reviewer | Domain | Does NOT cover |
| --- | --- | --- |
| `aslan-akbey` | Correctness, conventions, maintainability, performance | Security, race conditions, adversarial misuse |
| `iskender` | Security (OWASP), race conditions, data integrity, misuse flows | General logic errors, naming, conventions |

## Repair escalation

`tuncay` has a hard limit of **2 repair attempts**. If the fix does not pass after 2 attempts:

```
ESCALATE: {root_cause} | tried: {summary_of_both_attempts} | blocker: {why_still_failing}
```

Polat reassigns or asks the user.
