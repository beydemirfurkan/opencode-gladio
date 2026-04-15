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
        const status = runtime.getPhase(sessionID) === "complete" ? "completed" : "interrupted";
        const snapshot = runtime.buildPipelineSnapshot(sessionID, status);

        if (snapshot) {
          memory.savePipelineState(snapshot);
        }
      }

      runtime.clearSession(sessionID);
    },
  };
}
