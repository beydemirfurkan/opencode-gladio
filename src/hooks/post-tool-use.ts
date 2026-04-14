import type { HookProfile } from "../types";
import type { HookRuntime } from "./runtime";
import {
  resolveFilePathFromArgs,
  resolveSessionID,
  resolveToolArgs,
  resolveToolName,
  stringifyToolOutput,
} from "./runtime";

export function createPostToolUseHook(
  _config: unknown,
  runtime: HookRuntime,
  _profile: HookProfile,
) {
  return {
    "tool.execute.after": async (input: unknown, output?: unknown): Promise<void> => {
      const sessionID = resolveSessionID(input);
      const tool = resolveToolName(input);
      const args = resolveToolArgs(input);
      const filePath = resolveFilePathFromArgs(args);

      if (sessionID && filePath && ["write", "edit"].includes(tool ?? "")) {
        runtime.rememberEditedFile(sessionID, filePath);
      }

      if (sessionID && output) {
        const outputText = stringifyToolOutput(output);
        const estimatedOutput = Math.ceil(outputText.length / 4);
        runtime.tokenManager.trackUsage(sessionID, 0, estimatedOutput);
      }
    },
  };
}
