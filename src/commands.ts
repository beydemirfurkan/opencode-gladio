import type { HarnessConfig } from "./types";

export function createHarnessCommands(
  config: HarnessConfig,
): Record<string, Record<string, unknown>> {
  if (config.commands?.enabled === false) {
    return {};
  }

  return {
    "create-skill": {
      template:
        "Analyze the current session learnings and create a reusable skill from them. Save to ~/.config/opencode/skills/. $ARGUMENTS",
      description: "Create a skill from session learnings.",
      agent: "polat",
    },
  };
}
