import type { HookProfile, HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import {
  profileMatches,
  resolveHooksConfig,
  resolveSessionID,
  resolveToolName,
  resolveToolArgs,
} from "./runtime";

const EXTENSION_NUDGES: Record<string, string[]> = {
  ".ts": ["tsc --noEmit", "vitest run", "jest --passWithNoTests"],
  ".tsx": ["tsc --noEmit", "vitest run"],
  ".go": ["go build ./...", "go test ./..."],
  ".rs": ["cargo check", "cargo test"],
  ".py": ["python -m pytest", "ruff check"],
};

function resolveFilePath(args: Record<string, unknown>): string | undefined {
  if (typeof args.filePath === "string") return args.filePath;
  if (typeof args.path === "string") return args.path;
  if (typeof args.file === "string") return args.file;
  if (typeof args.filename === "string") return args.filename;
  return undefined;
}

function extractExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return filePath.slice(dotIndex).toLowerCase();
}

function buildNudgeMessage(extension: string): string | undefined {
  const commands = EXTENSION_NUDGES[extension];
  if (!commands || commands.length === 0) return undefined;
  const first = commands[0];
  return `[PostEdit] ${extension} file changed. Consider running \`${first}\`.`;
}

function isFileWriteTool(tool: string | undefined, args: Record<string, unknown>): boolean {
  if (!tool) return false;
  if (tool === "edit" || tool === "write" || tool === "edit_file" || tool === "write_file") return true;
  if (tool === "bash" && typeof args.command === "string") {
    const cmd = args.command.toLowerCase();
    return cmd.includes("> ") || cmd.includes(">> ") || cmd.includes("tee ") || cmd.includes("redirect");
  }
  return false;
}

export function createPostToolUseHook(
  config: HarnessConfig,
  runtime: HookRuntime,
  profile: HookProfile,
) {
  const hooksConfig = resolveHooksConfig(config);
  const nudgeEnabled = hooksConfig.post_tool_use_nudge !== false;
  const checkpointInterval = hooksConfig.checkpoint_interval ?? 10;

  return {
    "tool.execute.after": async (input: unknown, _output?: unknown): Promise<void> => {
      const sessionID = resolveSessionID(input);
      const tool = resolveToolName(input);
      const args = resolveToolArgs(input);

      if (!sessionID) return;

      const toolCount = runtime.getToolCount(sessionID);

      if (nudgeEnabled && profileMatches(profile, ["standard", "strict"])) {
        if (isFileWriteTool(tool, args)) {
          const filePath = resolveFilePath(args);
          if (filePath) {
            const ext = extractExtension(filePath);
            const nudge = buildNudgeMessage(ext);
            if (nudge) {
              const lastNudge = runtime.getLastNudge(sessionID);
              if (lastNudge !== nudge) {
                runtime.setLastNudge(sessionID, nudge);
                console.warn(`[opencode-gladio] ${nudge}`);
              }
            }
          }
        }
      }

      if (checkpointInterval > 0 && toolCount > 0 && toolCount % checkpointInterval === 0) {
        const phase = runtime.getPhase(sessionID);
        console.warn(
          `[opencode-gladio] [Pipeline] Tool #${toolCount}. Phase: ${phase}. Still on-tier? Re-check scope.`,
        );
      }
    },
  };
}
