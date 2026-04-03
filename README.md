# opencode-pair-autonomy

OpenCode harness with opinionated agent orchestration. One coordinator plus ten specialized workers (execution lead, implementer, researcher, reviewers, verifier, repair, frontend, explorer, chaos tester) and an automatic verify+review pipeline.

## What it does

- **Polat** as coordinator — plans, delegates, synthesizes, never asks for routine permission
- **Çakır** as execution lead — breaks plans into tasks and routes work to the specialists
- Automatic workflow: plan → implement (Memati/Güllü Erhan) → build/test/lint (Halit) → dual review (Aslan Akbey + İskender) → repair (Tuncay) → chaos & edge-case probing (Pala)
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
| **Halit**       | Verifier — build/test/lint gatekeeper                       | openai/gpt-5.4-mini none |
| **Tuncay**      | Repair specialist — fixes failing checks with minimal scope | openai/gpt-5.4 high |
| **Güllü Erhan** | Frontend specialist — UI, UX, Figma, browser automation     | openai/gpt-5.4 high |
| **Laz Ziya**    | Explorer — fast codebase reconnaissance and mapping        | openai/gpt-5.4-mini none |
| **Pala**        | Chaos tester — edge-case/misuse/race hunting               | openai/gpt-5.4 high |

## MCP Servers

`context7`, `grep_app`, `websearch`, `fff`, `jina`, `web-agent-mcp`, `figma-console`, `pg-mcp`, `ssh-mcp`, `mariadb`

## Quick start

```bash
bunx opencode-pair-autonomy install
```

From source:

```bash
git clone https://github.com/cemalturkcan/opencode-pair-autonomy.git
cd opencode-pair-autonomy
bun install && bun run build && bun link
opencode-pair-autonomy install
```

## Commands

```bash
opencode-pair-autonomy install        # wire into OpenCode config
opencode-pair-autonomy fresh-install  # rebuild harness files, keep user config
opencode-pair-autonomy uninstall      # remove harness wiring
opencode-pair-autonomy init           # create project-local config
opencode-pair-autonomy print-config   # inspect generated config
```

## Config

Merges from two layers (project wins):

- `~/.config/opencode/opencode-pair-autonomy.jsonc` — user-level
- `<project>/.opencode/opencode-pair-autonomy.jsonc` — project-level

Create project config:

```bash
opencode-pair-autonomy init
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
