import type { AgentLike, AgentOverride, HarnessConfig } from "./types";
import { deepMerge } from "./utils";
import { buildCoordinatorPrompt } from "./prompts/coordinator";
import { truncatePromptAppend, getAgentBudget } from "./token-manager";
import {
  buildChaosTesterPrompt,
  buildExecutionLeadPrompt,
  buildImplementerPrompt,
  buildResearcherPrompt,
  buildReviewerPrompt,
  buildAdversarialReviewerPrompt,
  buildVerifierPrompt,
  buildRepairPrompt,
  buildUiDeveloperPrompt,
  buildRepoScoutPrompt,
} from "./prompts/workers";

function withOverride(
  base: AgentLike,
  override?: Record<string, unknown>,
): AgentLike {
  if (!override) return base;
  return deepMerge(base, override);
}

function truncateOverridePrompt(
  override?: AgentOverride,
  agentName?: string,
): AgentOverride | undefined {
  if (!override) return undefined;
  const maxPromptChars = agentName ? getAgentBudget(agentName).promptChars : 4000;
  if (override.prompt_append) {
    override.prompt_append = truncatePromptAppend(override.prompt_append, maxPromptChars);
  }
  if (Object.keys(override).length === 0) return undefined;
  return override;
}

function taskPermissions(...allowedPatterns: string[]) {
  const permissions: Record<string, string> = { "*": "deny" };
  for (const pattern of allowedPatterns) {
    permissions[pattern] = "allow";
  }
  return permissions;
}

const COORDINATOR_TASK_PERMISSIONS = taskPermissions(
  "cakir",
  "memati",
  "abdulhey",
  "aslan-akbey",
  "iskender",
  "tuncay",
  "halit",
  "gullu-erhan",
  "laz-ziya",
  "pala",
);

function mcpDenyRules(...disabledPrefixes: string[]): Record<string, string> {
  const tools: Record<string, string> = {};
  for (const prefix of disabledPrefixes) {
    tools[`${prefix}_*`] = "deny";
  }
  return tools;
}

export function createHarnessAgents(
  config: HarnessConfig,
): Record<string, AgentLike> {
  const overrides = config.agents ?? {};
  const workerVisibilityMode = config.ui?.worker_visibility ?? "summary";
  const workersHidden = workerVisibilityMode !== "visible";

  return {
    polat: withOverride(
      {
        mode: "primary",
        description:
          "Polat — Orchestrator. Plans, delegates, synthesizes, manages the pipeline.",
        prompt: buildCoordinatorPrompt(
          overrides.polat?.prompt_append,
          workerVisibilityMode,
        ),
        color: "#4A90D9",
        permission: { task: COORDINATOR_TASK_PERMISSIONS },
      },
      overrides.polat,
    ),

    cakir: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Çakır — Execution lead. Breaks plans into tasks and routes specialists.",
        variant: "none",
        prompt: buildExecutionLeadPrompt(overrides.cakir?.prompt_append),
        temperature: 0.3,
        color: "#3498DB",
        permission: {
          task: taskPermissions(
            "memati",
            "abdulhey",
            "aslan-akbey",
            "iskender",
            "tuncay",
            "halit",
            "gullu-erhan",
            "laz-ziya",
            "pala",
          ),
          edit: "deny",
          bash: { "*": "deny" },
        },
      },
      overrides.cakir,
    ),

    memati: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Memati — Implementer. Delivers production code.",
        variant: "high",
        prompt: buildImplementerPrompt(overrides.memati?.prompt_append),
        temperature: 0.2,
        color: "#2ECC71",
      },
      overrides.memati,
    ),

    abdulhey: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Abdülhey — Researcher for docs, APIs, rationale.",
        variant: "none",
        prompt: buildResearcherPrompt(overrides.abdulhey?.prompt_append),
        temperature: 0.3,
        color: "#F39C12",
        tools: mcpDenyRules("context7"),
      },
      overrides.abdulhey,
    ),

    "aslan-akbey": withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Aslan Akbey — Senior reviewer. Correctness, maintainability.",
        variant: "xhigh",
        prompt: buildReviewerPrompt(overrides["aslan-akbey"]?.prompt_append),
        temperature: 0.1,
        color: "#E74C3C",
        tools: mcpDenyRules("websearch"),
        permission: {
          edit: "deny",
          bash: { "*": "deny" },
        },
      },
      overrides["aslan-akbey"],
    ),

    iskender: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "İskender — Adversarial reviewer. Security, race conditions, misuse.",
        variant: "xhigh",
        prompt: buildAdversarialReviewerPrompt(overrides.iskender?.prompt_append),
        temperature: 0.4,
        color: "#9B59B6",
        tools: mcpDenyRules("websearch"),
        permission: {
          edit: "deny",
          bash: { "*": "deny" },
        },
      },
      overrides.iskender,
    ),

    tuncay: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Tuncay — Scoped failure repair agent.",
        variant: "high",
        prompt: buildRepairPrompt(overrides.tuncay?.prompt_append),
        temperature: 0.1,
        color: "#E67E22",
        tools: mcpDenyRules("websearch"),
      },
      overrides.tuncay,
    ),

    halit: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Halit — Build and test verifier.",
        variant: "none",
        prompt: buildVerifierPrompt(overrides.halit?.prompt_append),
        temperature: 0.0,
        color: "#95A5A6",
        tools: mcpDenyRules("context7", "websearch"),
      },
      overrides.halit,
    ),

    "gullu-erhan": withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Güllü Erhan — Frontend specialist.",
        variant: "high",
        prompt: buildUiDeveloperPrompt(overrides["gullu-erhan"]?.prompt_append),
        temperature: 0.5,
        color: "#FF69B4",
      },
      overrides["gullu-erhan"],
    ),

    "laz-ziya": withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Laz Ziya — Fast codebase explorer.",
        variant: "none",
        prompt: buildRepoScoutPrompt(overrides["laz-ziya"]?.prompt_append),
        temperature: 0.1,
        color: "#1ABC9C",
        tools: mcpDenyRules("context7", "websearch"),
      },
      overrides["laz-ziya"],
    ),

    pala: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Pala — Chaos tester. Edge cases, misuse, race hunting.",
        variant: "high",
        prompt: buildChaosTesterPrompt(overrides.pala?.prompt_append),
        temperature: 0.45,
        color: "#8E44AD",
        tools: mcpDenyRules("context7", "websearch"),
        permission: {
          edit: "deny",
        },
      },
      overrides.pala,
    ),

    build: { disable: true },
    plan: { disable: true },
  };
}
