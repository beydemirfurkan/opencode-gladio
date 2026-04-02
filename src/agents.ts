import type { AgentLike, HarnessConfig } from "./types";
import { deepMerge } from "./utils";
import { buildCoordinatorPrompt } from "./prompts/coordinator";
import {
  buildWorkerPrompt,
  buildResearcherPrompt,
  buildReviewerPrompt,
  buildYetAnotherReviewerPrompt,
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

function taskPermissions(...allowedPatterns: string[]) {
  const permissions: Record<string, string> = { "*": "deny" };
  for (const pattern of allowedPatterns) {
    permissions[pattern] = "allow";
  }
  return permissions;
}

const COORDINATOR_TASK_PERMISSIONS = taskPermissions(
  "vicious",
  "eiri",
  "makishima",
  "johan",
  "bondrewd",
  "griffith",
  "ozu",
  "shounen-bat",
);

// Only the expensive MCPs are disabled on the coordinator (~30k token savings).
// Lighter MCPs stay open so the coordinator can use them directly.
const COORDINATOR_DISABLED_TOOLS: Record<string, boolean> = {
  "jina_*": false,
  "web-agent-mcp_*": false,
  "figma-console_*": false,
};

// Per-worker MCP restrictions: disable MCPs they don't need.
function workerDisabledMcps(
  ...disabledPrefixes: string[]
): Record<string, boolean> {
  const tools: Record<string, boolean> = {};
  for (const prefix of disabledPrefixes) {
    tools[`${prefix}_*`] = false;
  }
  return tools;
}

export function createHarnessAgents(
  config: HarnessConfig,
): Record<string, AgentLike> {
  const overrides = config.agents ?? {};

  return {
    // ── Coordinator (primary agent) ──────────────────────────────
    ryo: withOverride(
      {
        mode: "primary",
        description:
          "Ryo Asuka — Senior technical lead. Plans, argues, delegates, synthesizes.",
        model: "anthropic/claude-opus-4-6",
        variant: "max",
        prompt: buildCoordinatorPrompt(overrides.ryo?.prompt_append),
        tools: COORDINATOR_DISABLED_TOOLS,
        permission: { task: COORDINATOR_TASK_PERMISSIONS },
      },
      overrides.ryo,
    ),

    // ── Workers (subagents) ──────────────────────────────────────
    vicious: withOverride(
      {
        mode: "subagent",
        hidden: true,
        description: "Vicious — General purpose implementation worker.",
        model: "anthropic/claude-sonnet-4-6",
        variant: "max",
        prompt: buildWorkerPrompt(overrides.vicious?.prompt_append),
        tools: workerDisabledMcps("jina", "web-agent-mcp", "figma-console"),
      },
      overrides.vicious,
    ),

    eiri: withOverride(
      {
        mode: "subagent",
        hidden: true,
        description: "Eiri Masami — Web and doc researcher.",
        model: "anthropic/claude-sonnet-4-6",
        variant: "none",
        prompt: buildResearcherPrompt(overrides.eiri?.prompt_append),
        tools: workerDisabledMcps(
          "web-agent-mcp",
          "figma-console",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
      },
      overrides.eiri,
    ),

    makishima: withOverride(
      {
        mode: "subagent",
        hidden: true,
        description:
          "Makishima — Senior code reviewer. Finds subtle bugs and security issues.",
        model: "anthropic/claude-opus-4-6",
        variant: "max",
        prompt: buildReviewerPrompt(overrides.makishima?.prompt_append),
        tools: {
          ...workerDisabledMcps(
            "jina",
            "websearch",
            "web-agent-mcp",
            "figma-console",
            "pg-mcp",
            "ssh-mcp",
            "mariadb",
          ),
          bash: false,
          edit: false,
          write: false,
          patch: false,
        },
      },
      overrides.makishima,
    ),

    johan: withOverride(
      {
        mode: "subagent",
        hidden: true,
        description:
          "Johan Liebert — Cross-model independent reviewer for review diversity.",
        model: "openai/gpt-5.4",
        variant: "xhigh",
        prompt: buildYetAnotherReviewerPrompt(overrides.johan?.prompt_append),
        tools: {
          ...workerDisabledMcps(
            "jina",
            "websearch",
            "web-agent-mcp",
            "figma-console",
            "pg-mcp",
            "ssh-mcp",
            "mariadb",
          ),
          bash: false,
          edit: false,
          write: false,
          patch: false,
        },
      },
      overrides.johan,
    ),

    bondrewd: withOverride(
      {
        mode: "subagent",
        hidden: true,
        description: "Bondrewd — Build, test, lint verifier.",
        model: "anthropic/claude-sonnet-4-6",
        variant: "none",
        prompt: buildVerifierPrompt(overrides.bondrewd?.prompt_append),
        tools: workerDisabledMcps(
          "context7",
          "jina",
          "websearch",
          "grep_app",
          "web-agent-mcp",
          "figma-console",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
      },
      overrides.bondrewd,
    ),

    griffith: withOverride(
      {
        mode: "subagent",
        hidden: true,
        description: "Griffith — Scoped failure repair agent.",
        model: "anthropic/claude-sonnet-4-6",
        variant: "max",
        prompt: buildRepairPrompt(overrides.griffith?.prompt_append),
        tools: workerDisabledMcps(
          "jina",
          "websearch",
          "grep_app",
          "web-agent-mcp",
          "figma-console",
        ),
      },
      overrides.griffith,
    ),

    ozu: withOverride(
      {
        mode: "subagent",
        hidden: true,
        description:
          "Ozu — Frontend specialist with Figma and browser automation.",
        model: "anthropic/claude-sonnet-4-6",
        variant: "max",
        prompt: buildUiDeveloperPrompt(overrides.ozu?.prompt_append),
        tools: workerDisabledMcps("pg-mcp", "ssh-mcp", "mariadb"),
      },
      overrides.ozu,
    ),

    "shounen-bat": withOverride(
      {
        mode: "subagent",
        hidden: true,
        description: "Shounen Bat — Fast codebase explorer.",
        model: "anthropic/claude-sonnet-4-6",
        variant: "none",
        prompt: buildRepoScoutPrompt(overrides["shounen-bat"]?.prompt_append),
        tools: workerDisabledMcps(
          "context7",
          "jina",
          "websearch",
          "grep_app",
          "web-agent-mcp",
          "figma-console",
          "pg-mcp",
          "ssh-mcp",
          "mariadb",
        ),
      },
      overrides["shounen-bat"],
    ),

    // ── Disable OpenCode built-in agents ─────────────────────────
    build: { disable: true },
    plan: { disable: true },
  };
}
