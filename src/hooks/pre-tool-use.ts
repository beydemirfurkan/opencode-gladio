import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { BlockingHookError } from "./sdk";
import {
  profileMatches,
  resolveAgentName,
  resolveSessionID,
  resolveToolArgs,
  resolveToolName,
} from "./runtime";

const NODE_COMMAND_RE =
  /^(npm|pnpm|yarn|bun|npx|bunx|node|tsc|tsx|vite|next|nuxt|vitest|jest|eslint|prettier)\b/;

const NODE_MODULES_BIN_RE = /node_modules\/\.bin\//;

function isNodeCommand(command: string): boolean {
  return (
    NODE_COMMAND_RE.test(command.trim()) || NODE_MODULES_BIN_RE.test(command)
  );
}

function transformToCmd(command: string, winPath: string): string {
  return `cmd.exe /c "cd ${winPath} && ${command}"`;
}

function hasRecentBuildCheck(recentTools: string[]): boolean {
  return recentTools.some(
    (t) =>
      t.includes("tsc") ||
      t.includes("typecheck") ||
      t.includes("build") ||
      t.includes("test"),
  );
}

export function createPreToolUseHook(
  config: HarnessConfig,
  runtime: HookRuntime,
  profile: import("../types").HookProfile,
) {
  const recentBashBySession = new Map<string, string[]>();

  return {
    "tool.execute.before": async (input: unknown): Promise<void> => {
      const sessionID = resolveSessionID(input);
      const tool = resolveToolName(input);
      const args = resolveToolArgs(input);
      const agent =
        (sessionID ? runtime.getSessionAgent(sessionID) : undefined) ??
        resolveAgentName(input);

      if (sessionID) {
        runtime.incrementToolCount(sessionID);
      }

      // ── WSL node command auto-transform ─────────────────────────
      if (
        tool === "bash" &&
        runtime.isWsl() &&
        typeof args.command === "string"
      ) {
        const command = args.command.trim();
        if (isNodeCommand(command)) {
          const transformed = transformToCmd(command, runtime.getWslWinPath());
          (args as Record<string, unknown>).command = transformed;
          runtime.appendObservation({
            timestamp: new Date().toISOString(),
            phase: "pre",
            sessionID,
            agent,
            tool,
            note: `wsl_auto_transform: ${command} -> cmd.exe`,
          });
        }
      }

      // ── Git push build gate ─────────────────────────────────────
      if (
        tool === "bash" &&
        typeof args.command === "string" &&
        args.command.includes("git push") &&
        profileMatches(profile, ["standard", "strict"])
      ) {
        const sessionCmds = sessionID
          ? (recentBashBySession.get(sessionID) ?? [])
          : [];
        if (!hasRecentBuildCheck(sessionCmds)) {
          throw new BlockingHookError(
            "[Safety] No build/typecheck detected before git push. Run typecheck first, then push.",
          );
        }
      }

      // ── Track recent bash commands for build gate (per-session) ─
      if (tool === "bash" && typeof args.command === "string" && sessionID) {
        let cmds = recentBashBySession.get(sessionID);
        if (!cmds) {
          cmds = [];
          recentBashBySession.set(sessionID, cmds);
        }
        cmds.push(args.command);
        if (cmds.length > 10) {
          cmds.shift();
        }
      }

      // ── Compact suggestion ──────────────────────────────────────
      if (
        sessionID &&
        runtime.shouldSuggestCompact(sessionID) &&
        profileMatches(profile, ["standard", "strict"])
      ) {
        runtime.appendObservation({
          timestamp: new Date().toISOString(),
          phase: "pre",
          sessionID,
          agent,
          tool,
          note: "compact_suggested",
        });
      }

      // ── Observation logging ─────────────────────────────────────
      runtime.appendObservation({
        timestamp: new Date().toISOString(),
        phase: "pre",
        sessionID,
        agent,
        tool,
      });
    },
  };
}
