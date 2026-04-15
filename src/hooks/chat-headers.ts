import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveHooksConfig, resolveSessionID } from "./runtime";

const AGENT_LABELS: Record<string, string> = {
  polat: "coordinator",
  cakir: "execution lead",
  memati: "implementer",
  abdulhey: "researcher",
  "aslan-akbey": "correctness reviewer",
  iskender: "adversarial reviewer",
  tuncay: "repair",
  halit: "verifier",
  "gullu-erhan": "frontend",
  "laz-ziya": "explorer",
  pala: "chaos tester",
};

function buildHeader(agent: string): string {
  const label = AGENT_LABELS[agent] ?? agent;
  return `\n── ${agent} (${label}) ──\n`;
}

export function createChatHeadersHook(config: HarnessConfig, runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);

  return {
    "experimental.chat.messages.transform": async (
      input: { sessionID?: string },
      output: { messages?: Array<{ role?: string; content?: string }> },
    ): Promise<void> => {
      if (hooksConfig.chat_headers === false) return;

      const sessionID = input.sessionID;
      if (!sessionID) return;
      if (!output.messages || !Array.isArray(output.messages)) return;

      const visibility = config.ui?.worker_visibility;
      if (visibility === "off") return;

      const lastMsg = output.messages[output.messages.length - 1];
      if (!lastMsg || lastMsg.role !== "assistant" || typeof lastMsg.content !== "string") return;

      const agent = runtime.getSessionAgent(sessionID);
      if (!agent) return;

      if (visibility === "visible" || (visibility === "summary" && agent !== "polat")) {
        lastMsg.content = `${buildHeader(agent)}${lastMsg.content}`;
      }
    },
  };
}
