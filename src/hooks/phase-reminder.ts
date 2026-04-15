import type { HarnessConfig } from "../types";
import type { HookRuntime, PipelinePhase } from "./runtime";
import { resolveHooksConfig } from "./runtime";

export function createPhaseReminderHook(config: HarnessConfig, runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);
  const stuckThreshold = hooksConfig.stuck_threshold ?? 5;

  return {
    "experimental.chat.messages.transform": async (
      input: { sessionID?: string },
      output: { messages?: Array<{ role?: string; content?: string }> },
    ): Promise<void> => {
      if (hooksConfig.phase_reminder === false) return;

      const sessionID = input.sessionID;
      if (!sessionID) return;
      if (!output.messages || !Array.isArray(output.messages)) return;

      const lastMsg = output.messages[output.messages.length - 1];
      if (!lastMsg || lastMsg.role !== "assistant" || typeof lastMsg.content !== "string") return;

      const content = lastMsg.content;
      const phase = runtime.updatePhase(sessionID, content);
      const stuckCount = runtime.getPhaseStuckCount(sessionID);

      if (phase !== "unknown" && phase !== "complete") {
        lastMsg.content = `[Phase: ${phase}] ${lastMsg.content}`;
      }

      if (stuckCount >= stuckThreshold) {
        lastMsg.content = `[Pipeline Warning] Stuck in phase "${phase}" (${stuckCount} messages). Consider escalating or re-scoping.\n\n${lastMsg.content}`;
      }
    },
  };
}
