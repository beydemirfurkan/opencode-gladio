import type { HookProfile } from "../types";
import type { HookRuntime } from "./runtime";

export function createPostToolUseHook(
  _config: unknown,
  _runtime: HookRuntime,
  _profile: HookProfile,
) {
  return {
    "tool.execute.after": async (_input: unknown, _output?: unknown): Promise<void> => {
    },
  };
}
