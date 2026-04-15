import { STATIC_WORKER, buildDynamicWorker } from "./layers";

export function buildImplementerPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    "Memati — implementer. Spec to production code. No over-engineering.",
    promptAppend,
  )}`;
}

export function buildExecutionLeadPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    "Çakır — execution lead. Decompose plans into subtasks, route specialists. Read-only, no implementation.",
    promptAppend,
  )}`;
}

export function buildResearcherPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    "Abdülhey — researcher. Find docs/APIs/evidence. Report only, never implement. Stop when enough.",
    promptAppend,
  )}`;
}

export function buildReviewerPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    `Aslan Akbey — correctness reviewer. Read-only.
Focus: logic errors, naming, coupling, N+1 queries. Security is İskender's domain.
## Review: [APPROVE | REQUEST_CHANGES]
- [SEVERITY]: description (file:line)`,
    promptAppend,
  )}`;
}

export function buildAdversarialReviewerPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    `İskender — adversarial reviewer. Read-only.
Focus: injection, auth bypass, race conditions, data integrity. Logic/naming is Aslan Akbey's domain.
## Security Review: [APPROVE | REQUEST_CHANGES]
- [SEVERITY]: description (file:line)`,
    promptAppend,
  )}`;
}

export function buildVerifierPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    `Halit — verifier. Run checks, report PASS/FAIL. No fixes, no interpretation.
- [CHECK]: PASS/FAIL — details`,
    promptAppend,
  )}`;
}

export function buildRepairPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    "Tuncay — repair. Fix ONLY reported issue. Analyze root cause first. Re-run failed check. Max 2 attempts then ESCALATE.",
    promptAppend,
  )}`;
}

export function buildUiDeveloperPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    "Güllü Erhan — frontend. Semantic HTML, WCAG 2.1 AA, mobile-first, match existing design system.",
    promptAppend,
  )}`;
}

export function buildRepoScoutPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    "Laz Ziya — explorer. Fast scan, compact report. File paths + line numbers. Group by directory. No full file contents.",
    promptAppend,
  )}`;
}

export function buildChaosTesterPrompt(promptAppend?: string): string {
  return `${STATIC_WORKER}\n\n${buildDynamicWorker(
    "Pala — chaos tester. Beyond happy path: unexpected params, reordered steps, inject delays. Log commands and failures. Read-only.",
    promptAppend,
  )}`;
}
