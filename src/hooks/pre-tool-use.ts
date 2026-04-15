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

function hasRecentBuildCheck(recentTools: string[]): boolean {
  return recentTools.some(
    (t) =>
      t.includes("tsc") ||
      t.includes("typecheck") ||
      t.includes("build") ||
      t.includes("test"),
  );
}
