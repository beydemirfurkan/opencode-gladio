import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveHooksConfig, resolveSessionID } from "./runtime";

export function createTodoContinuationHook(config: HarnessConfig, runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);

  return {
    "session.idle": async (input?: unknown): Promise<void> => {
      if (hooksConfig.todo_continuation === false) return;

      const sessionID = resolveSessionID(input);
      if (!sessionID) return;

      const phase = runtime.getPhase(sessionID);
      const toolCount = runtime.getToolCount(sessionID);

      if (toolCount > 0 && phase !== "complete") {
        console.warn(
          `[opencode-gladio] [UnfinishedWork] Session idle at phase "${phase}" after ${toolCount} tools. Pending work may exist. Type "continue" to resume.`,
        );
      }
    },
  };
}
