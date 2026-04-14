import type { PluginInput } from "@opencode-ai/plugin";
import type { HookRuntime } from "./runtime";
import { resolveSessionOrEntityID } from "./runtime";

export function createStopHook(_ctx: PluginInput, runtime: HookRuntime) {
  return {
    "session.idle": async (input?: unknown): Promise<void> => {
      const sessionID = resolveSessionOrEntityID(input);
      if (!sessionID) return;
      runtime.clearSession(sessionID);
    },
  };
}
