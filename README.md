<p align="center">
  <strong>opencode-gladio</strong>
</p>

<p align="center">
  Disciplined orchestration plugin for <a href="https://opencode.ai">OpenCode</a>.<br>
  One coordinator. Ten specialists. Automatic 4-tier pipeline. Zero ambiguity.
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/opencode-gladio?color=blue&label=npm" alt="npm" />
  <img src="https://img.shields.io/npm/dt/opencode-gladio?color=green" alt="downloads" />
  <img src="https://img.shields.io/github/license/beydemirfurkan/opencode-gladio" alt="license" />
  <img src="https://img.shields.io/node/v/opencode-gladio" alt="node" />
</p>

---

## Philosophy

Other orchestration plugins give you flexibility. Gladio gives you **discipline**.

Every task passes through a forced pipeline: ambiguity check → tier classification → worker chain → verification. No skipped steps. No guessing. No "I'll just do it all myself."

**The trade-off:** More overhead on trivial tasks. **The payoff:** Correct, reviewed, verified results on everything else.

## Quick Start

```bash
npx opencode-gladio install
```

That's it. Open OpenCode and start working. Polat (the coordinator) handles the rest.

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

| Agent | Role | Model | When |
|-------|------|-------|------|
| **Polat** | Coordinator | `gpt-5.4` | Always active |
| **Çakır** | Execution lead | `gpt-5.4-mini` | Complex decomposition |
| **Memati** | Implementer | `gpt-5.4` | Tier 2+ |
| **Abdülhey** | Researcher | `gpt-5.4-mini` | Docs, APIs, evidence |
| **Aslan Akbey** | Correctness reviewer | `gpt-5.4` | Tier 3+ review |
| **İskender** | Adversarial reviewer | `gpt-5.4` | Tier 3+ review |
| **Tuncay** | Repair specialist | `gpt-5.4-mini` | Review rejection |
| **Halit** | Verifier | `gpt-5.4-mini` | Build/test PASS/FAIL |
| **Güllü Erhan** | Frontend specialist | `gpt-5.4` | UI/UX tasks |
| **Laz Ziya** | Explorer | `gpt-5.4-mini` | Fast codebase mapping |
| **Pala** | Chaos tester | `gpt-5.4-mini` | Tier 4 |

Fast model agents (mini) handle research, verification, and repair. Full model agents handle implementation, review, and coordination.

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

JSON Schema autocomplete:

```json
{
  "$schema": "https://unpkg.com/opencode-gladio@latest/opencode-gladio.schema.json"
}
```

### Minimal

Works out of the box. No config needed.

### Worker Visibility

```jsonc
{
  "ui": {
    "worker_visibility": "visible"  // "visible" | "summary" | "hidden"
  }
}
```

### Model Fallback

Automatic model switching on rate limits:

```jsonc
{
  "fallbacks": {
    "enabled": true,
    "chains": {
      "polat": ["openai/gpt-5.4", "anthropic/claude-sonnet-4-20250514"],
      "halit": ["openai/gpt-5.4-mini", "openai/gpt-5.4"]
    }
  }
}
```

### Agent Overrides

Override any agent's model, variant, or prompt:

```jsonc
{
  "agents": {
    "polat": { "variant": "xhigh" },
    "memati": { "model": "anthropic/claude-sonnet-4-20250514" },
    "abdulhey": {
      "prompt_append": "Always cite sources with URLs."
    }
  }
}
```

### Tmux Multiplexer

Real-time worker monitoring:

```jsonc
{
  "multiplexer": {
    "type": "tmux",
    "layout": "main-vertical",
    "main_pane_size": 60
  }
}
```

### Remote MCPs

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

### Full Example

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
    "polat": { "variant": "xhigh" }
  }
}
```

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
