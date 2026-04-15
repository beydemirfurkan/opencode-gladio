<div align="center">

# ⚔️ opencode-gladio

**Disciplined orchestration plugin for [OpenCode](https://opencode.ai)**

One coordinator. Ten specialists. Automatic 4-tier pipeline. Zero ambiguity.

[![npm version](https://img.shields.io/npm/v/opencode-gladio?color=blue&label=npm&style=flat-square)](https://www.npmjs.com/package/opencode-gladio)
[![npm downloads](https://img.shields.io/npm/dt/opencode-gladio?color=green&style=flat-square)](https://www.npmjs.com/package/opencode-gladio)
[![license](https://img.shields.io/github/license/beydemirfurkan/opencode-gladio?style=flat-square)](https://github.com/beydemirfurkan/opencode-gladio/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/opencode-gladio?style=flat-square)](https://nodejs.org)

</div>

---

## Install

```bash
npx opencode-gladio install
```

or install globally:

```bash
npm i -g opencode-gladio
opencode-gladio install
```

That's it. Open OpenCode and start working. Polat (the coordinator) handles the rest.

## Philosophy

Other orchestration plugins give you flexibility. Gladio gives you **discipline**.

Every task passes through a forced pipeline: ambiguity check → tier classification → worker chain → verification. No skipped steps. No guessing. No "I'll just do it all myself."

**The trade-off:** More overhead on trivial tasks. **The payoff:** Correct, reviewed, verified results on everything else.

## How It Works

```
User gives a task
       ↓
  ┌─────────────┐
  │ ClarityGate │  ← Ambiguous? Ask questions first.
  └──────┬──────┘
         ↓ Clear
  ┌─────────────┐
  │ Tier Class. │  ← "Tier 2 because: 3 files, low risk"
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │  Pipeline   │  ← Forced worker chain for that tier
  └──────┬──────┘
         ↓
     Result
```

### ClarityGate

Before any work starts, Polat checks: is this task specific enough?

- **Specific task** → Skip straight to tier classification. No questions.
- **Vague task** → 1-3 focused questions to the user. Wait for answers. Then proceed.

```
"Fix the null crash in auth.ts:42"     → Act immediately.
"Make the app faster"                  → "What specifically is slow? Which operations?"
"Add caching"                          → "Which data? TTL expectations? Invalidation strategy?"
```

Workers can also push back. If a delegated task lacks context, the worker returns `BLOCKED: <missing info>` instead of guessing.

### Tier Pipeline

Every task is classified into one of four tiers. Each tier has a **forced** worker chain — Polat cannot skip steps.

| Tier | Trigger | Pipeline |
|------|---------|----------|
| **1** Trivial | Single file, <20 lines | Polat implements directly |
| **2** Standard | 2-5 files, low risk | memati implements → halit verifies |
| **3** Risky | Auth, DB, API, 6+ files | memati → halit → **aslan-akbey + iskender** (parallel review) → tuncay repairs if needed |
| **4** Critical | Payments, prod data | Full Tier 3 → **pala** chaos tests |

**Dual review** (Tier 3+): Two reviewers work in parallel:
- **Aslan Akbey** — correctness, maintainability
- **İskender** — security, race conditions, edge cases

Both must pass. If either rejects, **Tuncay** does scoped repairs and the cycle repeats.

## Agents

All agents use your OpenCode default model. Override per-agent via config.

| Agent | Role | Variant | When |
|-------|------|---------|------|
| **Polat** | Coordinator | `high` | Always active |
| **Çakır** | Execution lead | `none` | Complex decomposition |
| **Memati** | Implementer | `high` | Tier 2+ |
| **Abdülhey** | Researcher | `none` | Docs, APIs, evidence |
| **Aslan Akbey** | Correctness reviewer | `high` | Tier 3+ review |
| **İskender** | Adversarial reviewer | `high` | Tier 3+ review |
| **Tuncay** | Repair specialist | `high` | Review rejection |
| **Halit** | Verifier | `none` | Build/test PASS/FAIL |
| **Güllü Erhan** | Frontend specialist | `high` | UI/UX tasks |
| **Laz Ziya** | Explorer | `none` | Fast codebase mapping |
| **Pala** | Chaos tester | `high` | Tier 4 |

## CLI

```bash
opencode-gladio install          # Install into OpenCode config
opencode-gladio fresh-install    # Reinstall, keep user config
opencode-gladio uninstall        # Remove from OpenCode config
opencode-gladio doctor           # Health check
opencode-gladio print-config     # Print resolved config
```

## Configuration

Config file: `~/.config/opencode/opencode-gladio.jsonc`

<details>
<summary><strong>JSON Schema</strong> — autocomplete in your editor</summary>

```json
{
  "$schema": "https://unpkg.com/opencode-gladio@latest/opencode-gladio.schema.json"
}
```

</details>

<details>
<summary><strong>Worker Visibility</strong></summary>

```jsonc
{
  "ui": {
    "worker_visibility": "visible"  // "visible" | "summary" | "hidden"
  }
}
```

</details>

<details>
<summary><strong>Model Fallback</strong> — auto-switch on rate limits</summary>

```jsonc
{
  "fallbacks": {
    "enabled": true,
    "chains": {
      "polat": ["zai/glm-5.1", "anthropic/claude-sonnet-4-20250514"],
      "halit": ["opencode-go/kimi-k2.5", "zai/glm-5.1"]
    }
  }
}
```

</details>

<details>
<summary><strong>Agent Overrides</strong> — model, variant, or prompt per agent</summary>

Override any agent. Works with any provider configured in your OpenCode config:

```jsonc
{
  "agents": {
    "polat": { "model": "zai/glm-5.1", "variant": "high" },
    "memati": { "model": "anthropic/claude-sonnet-4-20250514" },
    "halit": { "model": "opencode-go/kimi-k2.5" },
    "abdulhey": {
      "prompt_append": "Always cite sources with URLs."
    }
  }
}
```

</details>

<details>
<summary><strong>Tmux Multiplexer</strong> — real-time worker monitoring</summary>

```jsonc
{
  "multiplexer": {
    "type": "tmux",
    "layout": "main-vertical",
    "main_pane_size": 60
  }
}
```

</details>

<details>
<summary><strong>Remote MCPs</strong></summary>

Three remote MCP servers are available (all enabled by default):

```jsonc
{
  "mcps": {
    "context7": true,
    "grep_app": true,
    "websearch": true
  }
}
```

</details>

<details>
<summary><strong>Full Config Example</strong></summary>

```jsonc
{
  "$schema": "https://unpkg.com/opencode-gladio@latest/opencode-gladio.schema.json",
  "schema_version": 2,
  "ui": { "worker_visibility": "visible" },
  "hooks": { "profile": "standard" },
  "mcps": { "context7": true, "grep_app": true, "websearch": true },
  "fallbacks": { "enabled": true, "chains": {} },
  "multiplexer": { "type": "none" },
  "agents": {
    "polat": { "model": "zai/glm-5.1", "variant": "high" },
    "memati": { "model": "anthropic/claude-sonnet-4-20250514" },
    "halit": { "model": "opencode-go/kimi-k2.5" }
  }
}
```

</details>

## Architecture

```
src/
├── index.ts              # Plugin entry, hook registration
├── agents.ts             # Agent definitions
├── tier-router.ts        # Tier classification helpers
├── token-manager.ts      # Token budget, compact, pruning
├── fallback-manager.ts   # Runtime model fallback
├── multiplexer.ts        # Tmux integration
├── protocol.ts           # Structured delegation protocol
├── prompts/
│   ├── layers.ts         # Static/dynamic prompt layering
│   ├── coordinator.ts    # Coordinator prompt builder
│   └── workers.ts        # Worker prompt builders
├── hooks/
│   ├── system-prompt.ts  # System prompt injection
│   ├── runtime.ts        # Hook runtime utilities
│   ├── pre-tool-use.ts   # Input token tracking
│   ├── post-tool-use.ts  # Output token tracking
│   └── pre-compact.ts    # Context compression
├── config.ts             # Config loading, migration
├── installer.ts          # CLI installer
├── doctor.ts             # Health diagnostics
└── cli.ts                # CLI entry point
```

## Development

```bash
git clone https://github.com/beydemirfurkan/opencode-gladio.git
cd opencode-gladio
npm install
npm run build
npm test
```

## License

MIT
