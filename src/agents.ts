import type { AgentLike, AgentOverride, HarnessConfig } from "./types";
import { deepMerge } from "./utils";
import { buildCoordinatorPrompt } from "./prompts/coordinator";
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
import { DEFAULT_PRIMARY_CANDIDATES, resolveFallbackState } from "./fallbacks";

function withOverride(
  base: AgentLike,
  override?: Record<string, unknown>,
): AgentLike {
  if (!override) return base;
  return deepMerge(base, override);
}

function sanitizeOverride(override?: AgentOverride): AgentOverride | undefined {
  if (!override) {
    return undefined;
  }

  const { model, variant, ...rest } = override;
  if (Object.keys(rest).length === 0) {
    return undefined;
  }

  return rest;
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

// Disable heavy browser automation MCP on coordinator to save tokens.
const COORDINATOR_DISABLED_TOOLS: Record<string, string> = {
  "web-agent-mcp_*": "deny",
};

// Per-worker MCP restrictions: disable MCPs they don't need.
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
  const fallbackState = resolveFallbackState(config);
  const coordinatorCandidate = fallbackState.coordinator.selectedCandidate;
  const verifierCandidate = fallbackState.verifier.selectedCandidate;

  return {
    // ── Coordinator (primary agent) ──────────────────────────────
    polat: withOverride(
      {
        mode: "primary",
        description:
          "Polat — Orchestrator of the harness. Plans, argues, delegates, synthesizes.",
        model: coordinatorCandidate.model ?? DEFAULT_PRIMARY_CANDIDATES.coordinator.model,
        variant: coordinatorCandidate.variant ?? DEFAULT_PRIMARY_CANDIDATES.coordinator.variant,
        prompt: buildCoordinatorPrompt(
          overrides.polat?.prompt_append,
          workerVisibilityMode,
        ),
        color: "#4A90D9",
        tools: COORDINATOR_DISABLED_TOOLS,
        permission: { task: COORDINATOR_TASK_PERMISSIONS },
      },
      sanitizeOverride(overrides.polat),
    ),

    // ── Workers (subagents) ──────────────────────────────────────
    cakir: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Çakır — Execution lead. Breaks plans into concrete work and routes it to specialists.",
        model: "openai/gpt-5.4",
        variant: "high",
        prompt: buildExecutionLeadPrompt(overrides.cakir?.prompt_append),
        temperature: 0.3,
        color: "#3498DB",
        tools: mcpDenyRules(
          "web-agent-mcp",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
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
        description: "Memati — Implementer. Delivers production code for the spec.",
        model: "openai/gpt-5.4",
        variant: "high",
        prompt: buildImplementerPrompt(overrides.memati?.prompt_append),
        temperature: 0.2,
        color: "#2ECC71",
        tools: mcpDenyRules("web-agent-mcp"),
      },
      overrides.memati,
    ),

    abdulhey: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Abdülhey — Researcher for docs, APIs, and rationale.",
        model: "openai/gpt-5.4",
        variant: "none",
        prompt: buildResearcherPrompt(overrides.abdulhey?.prompt_append),
        temperature: 0.3,
        color: "#F39C12",
        tools: mcpDenyRules(
          "web-agent-mcp",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
      },
      overrides.abdulhey,
    ),

    "aslan-akbey": withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Aslan Akbey — Senior reviewer who inspects correctness and conventions.",
        model: "openai/gpt-5.4",
        variant: "xhigh",
        prompt: buildReviewerPrompt(overrides["aslan-akbey"]?.prompt_append),
        temperature: 0.1,
        color: "#E74C3C",
        tools: mcpDenyRules(
          "websearch",
          "web-agent-mcp",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
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
          "İskender — Adversarial reviewer. Critically challenges assumptions and failure cases.",
        model: "openai/gpt-5.4",
        variant: "xhigh",
        prompt: buildAdversarialReviewerPrompt(overrides.iskender?.prompt_append),
        temperature: 0.4,
        color: "#9B59B6",
        tools: mcpDenyRules(
          "websearch",
          "web-agent-mcp",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
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
        model: "openai/gpt-5.4",
        variant: "high",
        prompt: buildRepairPrompt(overrides.tuncay?.prompt_append),
        temperature: 0.1,
        color: "#E67E22",
        tools: mcpDenyRules(
          "websearch",
          "grep_app",
          "web-agent-mcp",
        ),
      },
      overrides.tuncay,
    ),

    halit: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Halit — Build and test verifier.",
        model: verifierCandidate.model ?? DEFAULT_PRIMARY_CANDIDATES.verifier.model,
        variant: verifierCandidate.variant ?? DEFAULT_PRIMARY_CANDIDATES.verifier.variant,
        prompt: buildVerifierPrompt(overrides.halit?.prompt_append),
        temperature: 0.0,
        color: "#95A5A6",
        tools: mcpDenyRules(
          "context7",
          "websearch",
          "grep_app",
          "web-agent-mcp",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
      },
      sanitizeOverride(overrides.halit),
    ),

    "gullu-erhan": withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Güllü Erhan — Frontend specialist with browser automation.",
        model: "openai/gpt-5.4",
        variant: "high",
        prompt: buildUiDeveloperPrompt(overrides["gullu-erhan"]?.prompt_append),
        temperature: 0.5,
        color: "#FF69B4",
        tools: mcpDenyRules("pg-mcp", "ssh-mcp", "mariadb"),
      },
      overrides["gullu-erhan"],
    ),

    "laz-ziya": withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description: "Laz Ziya — Fast codebase explorer.",
        model: "openai/gpt-5.4-mini",
        variant: "none",
        prompt: buildRepoScoutPrompt(overrides["laz-ziya"]?.prompt_append),
        temperature: 0.1,
        color: "#1ABC9C",
        tools: mcpDenyRules(
          "context7",
          "websearch",
          "grep_app",
          "web-agent-mcp",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
      },
      overrides["laz-ziya"],
    ),

    pala: withOverride(
      {
        mode: "subagent",
        hidden: workersHidden,
        description:
          "Pala — Chaos tester specializing in edge cases and failure injection.",
        model: "openai/gpt-5.4",
        variant: "high",
        prompt: buildChaosTesterPrompt(overrides.pala?.prompt_append),
        temperature: 0.45,
        color: "#8E44AD",
        tools: mcpDenyRules(
          "context7",
          "websearch",
          "grep_app",
          "web-agent-mcp",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
        permission: {
          edit: "deny",
        },
      },
      overrides.pala,
    ),

    // ── Disable OpenCode built-in agents ─────────────────────────
    build: { disable: true },
    plan: { disable: true },
  };
}
