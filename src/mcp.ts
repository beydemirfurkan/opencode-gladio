import type { HarnessConfig } from "./types";

type McpConfig = Record<string, unknown>;

export function createHarnessMcps(
  config: HarnessConfig,
): Record<string, McpConfig> {
  const toggles = config.mcps ?? {};
  const result: Record<string, McpConfig> = {};

  if (toggles.context7 !== false) {
    result.context7 = {
      type: "remote",
      url: "https://mcp.context7.com/mcp",
      enabled: true,
      headers: process.env.CONTEXT7_API_KEY
        ? { Authorization: `Bearer ${process.env.CONTEXT7_API_KEY}` }
        : undefined,
      oauth: false,
      timeout: 60000,
    };
  }

  if (toggles.grep_app !== false) {
    result.grep_app = {
      type: "remote",
      url: "https://mcp.grep.app",
      enabled: true,
      oauth: false,
      timeout: 60000,
    };
  }

  if (toggles.websearch !== false) {
    result.websearch = {
      type: "remote",
      url: process.env.EXA_API_KEY
        ? `https://mcp.exa.ai/mcp?tools=web_search_exa&exaApiKey=${encodeURIComponent(process.env.EXA_API_KEY)}`
        : "https://mcp.exa.ai/mcp?tools=web_search_exa",
      enabled: true,
      ...(process.env.EXA_API_KEY
        ? { headers: { "x-api-key": process.env.EXA_API_KEY } }
        : {}),
      oauth: false,
      timeout: 60000,
    };
  }

  return result;
}
