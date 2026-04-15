import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveAgentName, resolveHooksConfig, resolveSessionID, resolveToolName } from "./runtime";

type JsonRecoveryOutcome = {
  status: "parsed" | "recovered" | "failed";
  data?: unknown;
};

type OutputText = {
  text: string;
  source: "string" | "error" | "output" | "json";
};

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

function extractOutputText(output: unknown): OutputText | undefined {
  if (typeof output === "string") {
    return { text: output, source: "string" };
  }

  if (!output || typeof output !== "object") {
    return undefined;
  }

  const record = output as Record<string, unknown>;
  if (typeof record.error === "string") {
    return { text: record.error, source: "error" };
  }

  if (typeof record.output === "string") {
    return { text: record.output, source: "output" };
  }

  return { text: JSON.stringify(output), source: "json" };
}

function hasStructuredJsonCandidate(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[") || /```(?:json)?\s*[\r\n]/i.test(text);
}

function looksLikeJsonParseFailure(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("json") &&
    (lower.includes("parse") || lower.includes("unexpected") || lower.includes("syntaxerror"))
  ) || lower.includes("unexpected token") || lower.includes("json parse error");
}

function shouldInspectJson(tool: string | undefined, text: string): boolean {
  const lowerTool = tool?.toLowerCase() ?? "";
  const explicitJsonTool = lowerTool.includes("json") || lowerTool.includes("parse");
  const broadStructuredTool = lowerTool.includes("mcp") || lowerTool === "run_command";
  const parseFailure = looksLikeJsonParseFailure(text);
  const structuredCandidate = hasStructuredJsonCandidate(text);

  if (parseFailure) return true;
  if (explicitJsonTool && structuredCandidate) return true;
  if (broadStructuredTool && structuredCandidate) return true;
  return false;
}

function logRecoveryWarning(
  sessionID: string,
  agent: string | undefined,
  tool: string | undefined,
  source: OutputText["source"],
  message: string,
): void {
  console.warn(
    `[opencode-gladio] [JSONRecovery] session=${sessionID} agent=${agent ?? "unknown"} tool=${tool ?? "unknown"} source=${source} ${message}`,
  );
}

function attemptJsonRecovery(output: unknown): JsonRecoveryOutcome {
  if (!output) return { status: "failed" };

  const text = typeof output === "string"
    ? output
    : JSON.stringify(output);

  if (!text) return { status: "failed" };

  try {
    const parsed = JSON.parse(text);
    return { status: "parsed", data: parsed };
  } catch {
    // not valid JSON, try recovery
  }

  const fromMarkdown = tryExtractJsonFromMarkdown(text);
  if (fromMarkdown) {
    try {
      const parsed = JSON.parse(fromMarkdown);
      return { status: "recovered", data: parsed };
    } catch {
      // try fixing
    }
    const fixed = tryFixJson(fromMarkdown);
    if (fixed) {
      try {
        return { status: "recovered", data: JSON.parse(fixed) };
      } catch {
        // unfixable
      }
    }
  }

  const fixed = tryFixJson(text);
  if (fixed) {
    try {
      return { status: "recovered", data: JSON.parse(fixed) };
    } catch {
      // unfixable
    }
  }

  return { status: "failed" };
}

export function createJsonErrorRecoveryHook(config: HarnessConfig, _runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);

  return {
    "tool.execute.after": async (input: unknown, output?: unknown): Promise<void> => {
      if (hooksConfig.json_error_recovery === false) return;

      const sessionID = resolveSessionID(input);
      const tool = resolveToolName(input);
      const agent = resolveAgentName(input);
      if (!sessionID) return;

      if (!output) return;

      const extracted = extractOutputText(output);
      if (!extracted) return;

      if (!shouldInspectJson(tool, extracted.text)) return;

      const result = attemptJsonRecovery(extracted.text);

      if (result.status === "recovered") {
        logRecoveryWarning(sessionID, agent, tool, extracted.source, "Recovered JSON from malformed output.");
      } else if (result.status === "failed" && looksLikeJsonParseFailure(extracted.text)) {
        logRecoveryWarning(sessionID, agent, tool, extracted.source, "Failed to parse output. Raw output preserved. Agent should retry.");
      }
    },
  };
}
