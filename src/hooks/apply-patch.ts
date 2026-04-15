import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveHooksConfig, resolveSessionID, resolveToolName } from "./runtime";

const STALE_INDICATORS = [
  "stale",
  "outdated",
  "conflict",
  "does not match",
  "patch failed",
  "could not apply",
  "hunk failed",
];

function isStalePatchError(output: unknown): boolean {
  if (!output) return false;
  const text = typeof output === "string"
    ? output
    : JSON.stringify(output);
  if (!text) return false;
  const lower = text.toLowerCase();
  return STALE_INDICATORS.some((indicator) => lower.includes(indicator));
}

export function createApplyPatchHook(config: HarnessConfig, _runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);

  return {
    "tool.execute.after": async (input: unknown, output?: unknown): Promise<void> => {
      if (hooksConfig.apply_patch_rescue === false) return;

      const sessionID = resolveSessionID(input);
      const tool = resolveToolName(input);
      if (!sessionID) return;

      if (tool !== "apply-patch" && tool !== "edit" && tool !== "edit_file") return;

      if (isStalePatchError(output)) {
        const args = (input && typeof input === "object" && "args" in input)
          ? (input as Record<string, unknown>).args
          : undefined;
        const filePath = args && typeof args === "object" && "filePath" in args
          ? (args as Record<string, unknown>).filePath
          : undefined;

        const pathInfo = typeof filePath === "string" ? ` at ${filePath}` : "";
        console.warn(
          `[opencode-gladio] [PatchRescue] Patch failed due to stale context${pathInfo}. File should be re-read before retry. Retry with updated content.`,
        );
      }
    },
  };
}
