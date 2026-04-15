import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveHooksConfig, resolveSessionID, resolveToolName } from "./runtime";

function tryExtractJsonFromMarkdown(text: string): string | undefined {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return match?.[1]?.trim();
}

function tryFixJson(raw: string): string | undefined {
  let candidate = raw.trim();

  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  candidate = candidate.replace(/'/g, '"');

  candidate = candidate.replace(/(\w+)\s*:/g, '"$1":');

  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

function attemptJsonRecovery(output: unknown): { recovered: boolean; data?: unknown } {
  if (!output) return { recovered: false };

  const text = typeof output === "string"
    ? output
    : JSON.stringify(output);

  if (!text) return { recovered: false };

  try {
    const parsed = JSON.parse(text);
    return { recovered: true, data: parsed };
  } catch {
    // not valid JSON, try recovery
  }

  const fromMarkdown = tryExtractJsonFromMarkdown(text);
  if (fromMarkdown) {
    try {
      const parsed = JSON.parse(fromMarkdown);
      return { recovered: true, data: parsed };
    } catch {
      // try fixing
    }
    const fixed = tryFixJson(fromMarkdown);
    if (fixed) {
      try {
        return { recovered: true, data: JSON.parse(fixed) };
      } catch {
        // unfixable
      }
    }
  }

  const fixed = tryFixJson(text);
  if (fixed) {
    try {
      return { recovered: true, data: JSON.parse(fixed) };
    } catch {
      // unfixable
    }
  }

  return { recovered: false };
}

export function createJsonErrorRecoveryHook(config: HarnessConfig, _runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);

  return {
    "tool.execute.after": async (input: unknown, output?: unknown): Promise<void> => {
      if (hooksConfig.json_error_recovery === false) return;

      const sessionID = resolveSessionID(input);
      const tool = resolveToolName(input);
      if (!sessionID) return;

      if (!output) return;

      const outputText = typeof output === "string"
        ? output
        : (output as Record<string, unknown>)?.error as string | undefined
          ?? (output as Record<string, unknown>)?.output as string | undefined
          ?? JSON.stringify(output);

      const isJsonTool = tool?.includes("json") ||
        tool?.includes("parse") ||
        tool?.includes("mcp") ||
        tool === "run_command";

      const looksLikeBrokenJson = outputText.includes("JSON") &&
        (outputText.includes("parse") || outputText.includes("unexpected") || outputText.includes("SyntaxError"));

      if (!isJsonTool && !looksLikeBrokenJson) return;

      const result = attemptJsonRecovery(outputText);

      if (result.recovered) {
        console.warn("[opencode-gladio] [JSONRecovery] Recovered JSON from malformed output.");
      } else if (looksLikeBrokenJson) {
        console.warn("[opencode-gladio] [JSONRecovery] Failed to parse output. Raw output preserved. Agent should retry.");
      }
    },
  };
}
