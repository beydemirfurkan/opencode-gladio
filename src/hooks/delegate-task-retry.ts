import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveHooksConfig, resolveSessionID, resolveToolName, resolveToolArgs } from "./runtime";

export function createDelegateTaskRetryHook(config: HarnessConfig, runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);
  const maxRetries = hooksConfig.delegate_max_retries ?? 2;

  return {
    "tool.execute.after": async (input: unknown, output?: unknown): Promise<void> => {
      if (hooksConfig.delegate_retry === false) return;

      const sessionID = resolveSessionID(input);
      const tool = resolveToolName(input);
      const args = resolveToolArgs(input);
      if (!sessionID) return;

      const isDelegateTool = tool === "delegate-task" ||
        tool === "task" ||
        tool === "subagent" ||
        (typeof tool === "string" && tool.includes("delegate"));

      if (!isDelegateTool) return;

      const hasError = output &&
        ((typeof output === "object" && output !== null && "error" in output) ||
         (typeof output === "string" && (output.includes("error") || output.includes("failed"))));

      if (!hasError) return;

      const taskKey = typeof args.task === "string"
        ? args.task
        : typeof args.title === "string"
          ? args.title
          : String(tool);

      const retryCount = runtime.incrementDelegateRetry(sessionID, taskKey);

      if (retryCount <= maxRetries) {
        console.warn(
          `[opencode-gladio] [DelegateRetry] Task delegation failed (attempt ${retryCount}/${maxRetries}). Retrying with simplified scope.`,
        );
      } else {
        console.warn(
          `[opencode-gladio] [DelegateEscalate] Delegation failed after ${maxRetries} retries. Coordinator should handle directly.`,
        );
      }
    },
  };
}
