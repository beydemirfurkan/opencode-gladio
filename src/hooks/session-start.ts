import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
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
  const candidates = ["AGENTS.md", "README.md", "CONTRIBUTING.md", "ARCHITECTURE.md"];
  return candidates.filter((name) => existsSync(join(directory, name)));
}

export function createSessionStartHook(
  ctx: PluginInput,
  _config: HarnessConfig,
  runtime: HookRuntime,
) {
  return {
    "session.created": async (input?: unknown): Promise<void> => {
      const sessionID = resolveSessionOrEntityID(input);
      if (!sessionID) return;
      runtime.prepareSessionContext(sessionID);
    },
    "chat.message": async (input: ChatMessageInput, output: ChatMessageOutput): Promise<void> => {
      const agentName = input.agent ?? (typeof output.message.agent === "string" ? output.message.agent : undefined);
      runtime.setSessionAgent(input.sessionID, agentName);

      const factsLine = runtime.buildProjectFactsLine();
      const docs = detectProjectDocs(ctx.directory);
      const docsLine = docs.length > 0 ? `[ProjectDocs] Available: ${docs.join(", ")}` : "";

      if (agentName && !PRIMARY_AGENTS.has(agentName)) {
        const previousSystem = typeof output.message.system === "string" ? output.message.system.trim() : "";
        const injection = [factsLine, docsLine].filter(Boolean).join("\n");
        output.message.system = previousSystem ? `${previousSystem}\n\n${injection}` : injection;
        return;
      }

      const modeInjection = runtime.buildModeInjection();
      const previousSystem = typeof output.message.system === "string" ? output.message.system.trim() : "";
      const injection = [modeInjection, docsLine].filter(Boolean).join("\n\n");
      if (injection) {
        output.message.system = previousSystem ? `${previousSystem}\n\n${injection}` : injection;
      }
    },
  };
}
