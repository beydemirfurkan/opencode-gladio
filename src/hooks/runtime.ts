import { createHash } from "node:crypto";
import type { PluginInput } from "@opencode-ai/plugin";
import type { HarnessConfig, HookProfile } from "../types";
import { readText } from "../utils";
import {
  detectProjectFacts,
  joinProjectFactLabels,
  type ProjectFacts,
} from "../project-facts";

type SessionState = {
  agent?: string;
  toolCount: number;
};

function estimateKey(directory: string): string {
  return createHash("sha1").update(directory).digest("hex").slice(0, 12);
}

export function resolveHookProfile(config: HarnessConfig): HookProfile {
  return config.hooks?.profile ?? "standard";
}

export function profileMatches(
  profile: HookProfile,
  allowed: HookProfile | HookProfile[],
): boolean {
  return (Array.isArray(allowed) ? allowed : [allowed]).includes(profile);
}

export const PRIMARY_AGENTS = new Set(["polat"]);

export function resolveSessionID(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  if (typeof obj.sessionID === "string") return obj.sessionID;
  if (obj.info && typeof obj.info === "object") {
    const info = obj.info as Record<string, unknown>;
    if (typeof info.id === "string") return info.id;
  }
  if (obj.session && typeof obj.session === "object") {
    const session = obj.session as Record<string, unknown>;
    if (typeof session.id === "string") return session.id;
  }
  return undefined;
}

export function resolveSessionOrEntityID(value: unknown): string | undefined {
  const fromSession = resolveSessionID(value);
  if (fromSession) return fromSession;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
  }
  return undefined;
}

export function resolveAgentName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  if (typeof obj.agent === "string") return obj.agent;
  if (obj.message && typeof obj.message === "object") {
    const msg = obj.message as Record<string, unknown>;
    if (typeof msg.agent === "string") return msg.agent;
  }
  if (obj.info && typeof obj.info === "object") {
    const info = obj.info as Record<string, unknown>;
    if (typeof info.agent === "string") return info.agent;
  }
  return undefined;
}

export function resolveToolName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  return typeof obj.tool === "string" ? obj.tool : undefined;
}

export function resolveToolArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  return obj.args && typeof obj.args === "object" && !Array.isArray(obj.args)
    ? (obj.args as Record<string, unknown>)
    : {};
}

export function createHookRuntime(ctx: PluginInput, _config: HarnessConfig) {
  const sessions = new Map<string, SessionState>();
  const projectFacts = detectProjectFacts(ctx.directory);
  const projectID = estimateKey(ctx.directory);
  const wslMode = ctx.directory.startsWith("/mnt/");
  const wslWinPath = wslMode
    ? ctx.directory
        .replace(/^\/mnt\/(\w)/, (_, d: string) => `${d.toUpperCase()}:`)
        .replace(/\//g, "\\")
    : "";

  function ensureSession(sessionID: string): SessionState {
    const existing = sessions.get(sessionID);
    if (existing) return existing;
    const created: SessionState = { toolCount: 0 };
    sessions.set(sessionID, created);
    return created;
  }

  function buildModeInjection(): string {
    if (!wslMode) return "";
    return [
      `[WSL] Windows project at ${wslWinPath}. Read/Edit via /mnt/ paths.`,
      "Node tools (npm/pnpm/yarn/bun/npx/bunx/node/tsc/tsx/vite/next/nuxt/vitest/jest/eslint/prettier): run via cmd.exe.",
      "Git/SSH/curl/grep: WSL bash OK.",
    ].join("\n");
  }

  function buildProjectFactsLine(facts: ProjectFacts): string {
    const languages = facts.languages.length > 0 ? joinProjectFactLabels(facts.languages) : "unknown";
    const frameworks = facts.frameworks.length > 0 ? joinProjectFactLabels(facts.frameworks) : "none";
    return `[ProjectContext] id: ${projectID} | packageManager: ${facts.packageManager} | languages: ${languages} | frameworks: ${frameworks}`;
  }

  return {
    detectProjectFacts: () => projectFacts,
    buildProjectFactsLine: () => buildProjectFactsLine(projectFacts),
    prepareSessionContext: (sessionID: string) => {
      ensureSession(sessionID);
    },
    setSessionAgent: (sessionID: string, agent: string | undefined) => {
      if (!agent) return;
      ensureSession(sessionID).agent = agent;
    },
    getSessionAgent: (sessionID: string) => sessions.get(sessionID)?.agent,
    incrementToolCount: (sessionID: string) => {
      const state = ensureSession(sessionID);
      state.toolCount += 1;
      return state.toolCount;
    },
    clearSession: (sessionID: string) => {
      sessions.delete(sessionID);
    },
    readText,
    appendObservation: (_input: unknown) => {},
    isWsl: () => wslMode,
    getWslWinPath: () => wslWinPath,
    buildModeInjection,
  };
}

export type HookRuntime = ReturnType<typeof createHookRuntime>;
