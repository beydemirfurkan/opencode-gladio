# opencode-gladio

OpenCode harness with opinionated agent orchestration. One coordinator plus ten specialized workers (execution lead, implementer, researcher, reviewers, verifier, repair, frontend, explorer, chaos tester) plus a default verification-and-review routing policy.

## What it does

- **Polat** as coordinator — plans, delegates, synthesizes, never asks for routine permission
- **Çakır** as execution lead — breaks plans into tasks and routes work to the specialists
- Default flow when the change warrants it: plan → implement (Memati/Güllü Erhan) → verification (Halit: typecheck/tests and repo-available checks) → review (Aslan Akbey + İskender) → repair (Tuncay) → chaos & edge-case probing (Pala)
- Plan/Execute mode switching via `/go` and `/plan` commands
- Session memory with cross-session continuity
- Observation logging and pattern learning
- Comment guard that catches AI-slop in generated code

## Agents

| Agent           | Role                                                       | Model              |
| --------------- | ---------------------------------------------------------- | ------------------ |
| **Polat**       | Coordinator — plans, delegates, and orchestrates execution | openai/gpt-5.4 xhigh |
| **Çakır**       | Execution lead — decomposes plans and routes specialists    | openai/gpt-5.4 high |
| **Memati**      | Implementer — turns specs into production code             | openai/gpt-5.4 high |
| **Abdülhey**    | Researcher — digs through docs, APIs, and rationale         | openai/gpt-5.4 none |
| **Aslan Akbey** | Senior reviewer — correctness, maintainability reviews     | openai/gpt-5.4 xhigh |
| **İskender**    | Adversarial reviewer — breaks assumptions, edge cases       | openai/gpt-5.4 xhigh |
| **Halit**       | Verifier — repo checks gatekeeper                           | openai/gpt-5.4-mini none |
| **Tuncay**      | Repair specialist — fixes failing checks with minimal scope | openai/gpt-5.4 high |
| **Güllü Erhan** | Frontend specialist — UI, UX, Figma, browser automation     | openai/gpt-5.4 high |
| **Laz Ziya**    | Explorer — fast codebase reconnaissance and mapping        | openai/gpt-5.4-mini none |
| **Pala**        | Chaos tester — edge-case/misuse/race hunting               | openai/gpt-5.4 high |

## MCP Servers

`context7`, `grep_app`, `websearch`, `fff`, `jina`, `web-agent-mcp`, `figma-console`, `pg-mcp`, `ssh-mcp`, `mariadb`

## Quick start

```bash
bunx opencode-gladio install
```

From source:

```bash
git clone https://github.com/beydemirfurkan/opencode-gladio.git
cd opencode-gladio
bun install && bun run build && bun link
opencode-gladio install
```

## Commands

```bash
opencode-gladio install        # wire into OpenCode config
opencode-gladio fresh-install  # rebuild harness files, keep user config
opencode-gladio uninstall      # remove harness wiring
opencode-gladio init           # create project-local config
opencode-gladio print-config   # inspect generated config
```

## Config

Merges from two layers (project wins):

- `~/.config/opencode/opencode-gladio.jsonc` — user-level
- `<project>/.opencode/opencode-gladio.jsonc` — project-level

Create project config:

```bash
opencode-gladio init
```

## Hooks

| Hook                  | What it does                                                                       |
| --------------------- | ---------------------------------------------------------------------------------- |
| `session.created`     | Prepare session context injection                                                  |
| `chat.message`        | Inject mode, project docs, session memory (coordinator) or project facts (workers) |
| `tool.execute.before` | Plan mode gate, long-running command detection                                     |
| `tool.execute.after`  | Comment guard, file tracking, compact suggestions                                  |
| `session.idle`        | Save session summary, promote learned patterns, cleanup old sessions               |
| `session.compacting`  | Pre-compact observation snapshot                                                   |

## What install changes

- Patches OpenCode config with harness agents, MCPs, and commands
- Installs `fff-mcp` binary, shell strategy instructions
- Vendors `pg-mcp`, `ssh-mcp`, bundled skills
- Preserves existing user config on normal install

## What uninstall removes

Only harness-managed pieces: plugin wrappers, harness plugin entries, shell strategy entry, vendored background-agents. Preserves user config, MCP folders, skills.
