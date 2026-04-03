# Agent Matrix

## Coordinator

| Agent | Role | Model | Variant |
| --- | --- | --- | --- |
| `polat` | Primary coordinator. Plans the work, debates alternatives, delegates to workers, and synthesizes the final response. | `openai/gpt-5.4` | `xhigh` |

## Workers

| Agent | Role | Focus | Model | Variant |
| --- | --- | --- | --- | --- |
| `cakir` | Execution lead. Translates plans into discrete TODOs and routes them to specialists. | Task routing & accountability | `openai/gpt-5.4` | `high` |
| `memati` | Implementer. Delivers production code for the agreed spec. | Core implementation | `openai/gpt-5.4` | `high` |
| `abdulhey` | Researcher. Gathers docs, API references, and rationale. | Research & documentation | `openai/gpt-5.4` | `none` |
| `aslan-akbey` | Senior reviewer. Inspects correctness, conventions, and style. | Peer review | `openai/gpt-5.4` | `xhigh` |
| `iskender` | Adversarial reviewer. Challenges assumptions and uncovers subtle failure modes. | Adversarial critique | `openai/gpt-5.4` | `xhigh` |
| `tuncay` | Repair specialist. Fixes verifier-reported failures and sharpens retries. | Scoped failure recovery | `openai/gpt-5.4` | `high` |
| `halit` | Verifier. Runs builds, tests, and automated checks. | Verification & testing | `openai/gpt-5.4-mini` | `none` |
| `gullu-erhan` | UI developer. Handles frontend, browser automation, and Figma handoffs. | UI/UX implementation | `openai/gpt-5.4` | `high` |
| `laz-ziya` | Repo scout. Fast codebase explorer for context, patterns, and file discovery. | Reconnaissance | `openai/gpt-5.4-mini` | `none` |
| `pala` | Chaos tester. Exercises edge cases and failure injection. | Chaos & robustness | `openai/gpt-5.4` | `high` |

## Delegation & workflow

`polat` keeps the harness on track. After sketching the plan, they delegate execution to `cakir`, who hands off work items to implementers (`memati`, `gullu-erhan`), researchers (`abdulhey`), and specialists (`halit`, `tuncay`, `pala`, `laz-ziya`). Reviews involve `aslan-akbey` and `iskender` to catch stylistic issues and adversarial blind spots before `halit` runs the verification cycle. Failures cascade through `tuncay` for rapid repair, then back to the reviewers and verifiers. This mesh keeps every code edit fact-checked, reviewed, and bounded by the current GPT-based roster.
