import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import { detectLocaleFromTexts, extractTextParts } from "../i18n";
import { joinProjectFactLabels } from "../project-facts";
import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { PRIMARY_AGENTS, resolveSessionOrEntityID } from "./runtime";

type ChatMessageInput = {
  sessionID: string;
  agent?: string;
};

type ChatMessageOutput = {
  message: Record<string, unknown>;
  parts?: Array<{ type?: string; text?: string }>;
};

function detectProjectDocs(directory: string): string[] {
  const candidates = [
    "AGENTS.md",
    "README.md",
    "CONTRIBUTING.md",
    "ARCHITECTURE.md",
  ];
  return candidates.filter((name) => existsSync(join(directory, name)));
}

function buildResourceInjection(
  runtime: HookRuntime,
  directory: string,
): string {
  const parts: string[] = [];

  const docs = detectProjectDocs(directory);
  if (docs.length > 0) {
    parts.push(
      `[ProjectDocs] Available: ${docs.join(", ")}. Read these before starting domain-specific work.`,
    );
  }

  return parts.join("\n");
}

export function createSessionStartHook(
  ctx: PluginInput,
  config: HarnessConfig,
  runtime: HookRuntime,
) {
  return {
    "session.created": async (input?: unknown): Promise<void> => {
      const sessionID = resolveSessionOrEntityID(input);
      if (!sessionID) {
        return;
      }

      // Initialize plan mode to executing (no plan gate)
      runtime.setPlanMode(sessionID, "executing");

      if (
        config.memory?.enabled !== false ||
        config.learning?.enabled !== false
      ) {
        runtime.prepareSessionContext(sessionID);
      }
    },
    "chat.message": async (
      input: ChatMessageInput,
      output: ChatMessageOutput,
    ): Promise<void> => {
      const agentName =
        input.agent ??
        (typeof output.message.agent === "string"
          ? output.message.agent
          : undefined);
      runtime.setSessionAgent(input.sessionID, agentName);
      const locale = detectLocaleFromTexts(
        extractTextParts(output.parts ?? []),
      );
      runtime.setSessionLocale(input.sessionID, locale);

      // Subagents get minimal project facts only (no session context, no mode)
      if (agentName && !PRIMARY_AGENTS.has(agentName)) {
        const facts = runtime.detectProjectFacts();
        const languages =
          facts.languages.length > 0
            ? joinProjectFactLabels(facts.languages)
            : "unknown";
        const frameworks =
          facts.frameworks.length > 0
            ? joinProjectFactLabels(facts.frameworks)
            : "none";
        const factLine = `[ProjectContext] packageManager: ${facts.packageManager} | languages: ${languages} | frameworks: ${frameworks}`;

        const previousSystem =
          typeof output.message.system === "string"
            ? output.message.system.trim()
            : "";
        output.message.system = previousSystem
          ? `${previousSystem}\n\n${factLine}`
          : factLine;
        return;
      }

      // Build injection parts
      const injectionParts: string[] = [];

      // Mode injection (plan mode + WSL)
      const modeInjection = runtime.buildModeInjection(input.sessionID);
      if (modeInjection) {
        injectionParts.push(modeInjection);
      }

      // Resource injection (project docs)
      const resourceInjection = buildResourceInjection(runtime, ctx.directory);
      if (resourceInjection) {
        injectionParts.push(resourceInjection);
      }

      // Session context (memory + learning patterns)
      if (
        config.memory?.enabled !== false ||
        config.learning?.enabled !== false
      ) {
        const sessionContext = runtime.consumePendingInjection(
          input.sessionID,
          locale,
        );
        if (sessionContext) {
          injectionParts.push(sessionContext);
        }
      }

      if (injectionParts.length === 0) {
        return;
      }

      const injection = injectionParts.join("\n\n");
      const previousSystem =
        typeof output.message.system === "string"
          ? output.message.system.trim()
          : "";
      output.message.system = previousSystem
        ? `${previousSystem}\n\n${injection}`
        : injection;
    },
  };
}
