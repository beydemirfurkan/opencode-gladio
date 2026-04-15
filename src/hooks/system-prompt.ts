import type { HookRuntime } from "./runtime";

export function createSystemPromptHook(runtime: HookRuntime) {
  const memory = runtime.getMemory();

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
      const tierReminder = "[Pipeline] ClarityGate→Tier→Execute. Ambiguous? Ask first. Clear? \"Tier N because: <reason>\" → act.";
      const memoryLine = memory ? memory.buildInjectionLine() : "";
      const injection = [factsLine, modeLine, tierReminder, memoryLine].filter(Boolean).join("\n\n");
      if (!injection) return;
      output.system[0] = output.system[0] ? `${injection}\n\n${output.system[0]}` : injection;
    },
  };
}
