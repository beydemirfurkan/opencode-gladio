import type { HookRuntime } from "./runtime";
import { resolveSessionOrEntityID } from "./runtime";
import { getPruningRules } from "../token-manager";

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
        output.context.push(
          `[TokenManager] Pre-compact state: ${report.estimatedTokens} tokens used, ${report.budgetPercentUsed}% of budget. Tool count: ${report.toolCount}.`,
        );

        const rules = getPruningRules();
        const ruleDescriptions = rules
          .map((rule) => `  ${rule.priority}. ${rule.description}`)
          .join("\n");
        output.context.push(
          `[TokenManager] Pruning priorities (apply in order):\n${ruleDescriptions}`,
        );
      }

      if (output?.prompt) {
        output.prompt += "\n\nPreserve the most recent tool outputs and user messages. Prioritize dropping old repeated file reads and truncating verbose tool outputs older than 10 tool-calls.";
      }
    },
  };
}
