import type { PluginInput } from "@opencode-ai/plugin";
import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveSessionOrEntityID } from "./runtime";

export function createStopHook(_ctx: PluginInput, config: HarnessConfig, runtime: HookRuntime) {
  const memory = runtime.getMemory();

  return {
    "session.idle": async (input?: unknown): Promise<void> => {
      const sessionID = resolveSessionOrEntityID(input);
      if (!sessionID) return;

      if (memory && config.memory?.enabled !== false) {
        const phase = runtime.getPhase(sessionID);
        const toolCount = runtime.getToolCount(sessionID);
        const agent = runtime.getSessionAgent(sessionID);

        if (toolCount > 0) {
          memory.savePipelineState({
            ended_at: new Date().toISOString(),
            task: "",
            tier: 0,
            phase,
            workers_used: agent ? [agent] : [],
            files_modified: [],
            status: phase === "complete" ? "completed" : "interrupted",
          });
        }
      }

      runtime.clearSession(sessionID);
    },
  };
}
