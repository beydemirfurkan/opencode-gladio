import type { HookRuntime } from "./runtime";
import { resolveSessionOrEntityID } from "./runtime";
import { getPruningRules } from "../token-manager";
import { compressRawOutput } from "../protocol";

export function createPreCompactHook(runtime: HookRuntime) {
  return {
    "experimental.session.compacting": async (
      input?: unknown,
      output?: { context?: string[]; prompt?: string },
    ): Promise<void> => {
      const sessionID = resolveSessionOrEntityID(input);
      if (!sessionID) return;

      const agent = runtime.getSessionAgent(sessionID);
      const report = runtime.tokenManager.getReport(sessionID, agent);

      runtime.tokenManager.markCompacted(sessionID);

      if (output?.context) {
        const budget = report.budget;
        const overhead = report.budgetPercentUsed > 80
          ? "CRITICAL: Budget nearly exhausted. Aggressively prune."
          : `Budget: ${report.budgetPercentUsed}% used (${report.estimatedTokens}/${budget.compactThreshold}).`;

        output.context.push(
          `[Compact] ${overhead} Tools: ${report.toolCount}.`,
        );

        const rules = getPruningRules();
        const ruleDescriptions = rules
          .map((rule) => `  ${rule.priority}. ${rule.description}`)
          .join("\n");
        output.context.push(
          `[Compact] Pruning priorities:\n${ruleDescriptions}`,
        );

        if (report.budgetPercentUsed > 60) {
          output.context.push(
            "[Compact] Compress verbose tool outputs using this pattern: keep first 3 and last 2 lines, replace middle with `[${N} lines compressed]`.",
          );
        }
      }

      if (output?.prompt) {
        output.prompt += "\n\nPreserve recent tool outputs and user messages. Drop old repeated file reads. Truncate verbose outputs older than 10 tool-calls to summaries.";
      }
    },
  };
}
