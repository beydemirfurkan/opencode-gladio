import type { HookRuntime } from "./runtime";

export function createSystemPromptHook(runtime: HookRuntime) {
  return {
    "experimental.chat.system.transform": async (
      input: { sessionID?: string },
      output: { system: string[] },
    ): Promise<void> => {
      const sessionID = input.sessionID;
      if (!sessionID) return;
      const agent = runtime.getSessionAgent(sessionID);
      if (agent !== "polat") return;
      const factsLine = runtime.buildProjectFactsLine();
      const modeLine = runtime.buildModeInjection();
      const report = runtime.getTokenReport(sessionID);
      const budgetLine = report
        ? `[TokenBudget] ${report.budgetPercentUsed}% used (${report.estimatedTokens} / ${report.budget.compactThreshold}). Tools: ${report.toolCount}.`
        : "";
      const tierReminder = report ? `[Pipeline] ClarityGate→Tier→Execute. Ambiguous? Ask first. Clear? "Tier N because: <reason>" → act.` : "";
      const injection = [factsLine, modeLine, budgetLine, tierReminder].filter(Boolean).join("\n\n");
      if (!injection) return;
      output.system[0] = output.system[0] ? `${injection}\n\n${output.system[0]}` : injection;
    },
  };
}
