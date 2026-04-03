import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  HarnessConfig,
  OptionalComponentStatus,
  OptionalComponentStatuses,
} from "./types";
import {
  configRoot,
  isWebAgentMcpInstalled,
  resolveFffCommand,
  resolveMcpServerRoot,
} from "./mcp";

const MCP_TOGGLE_KEYS = [
  "context7",
  "grep_app",
  "websearch",
  "fff",
  "web_agent_mcp",
  "pg_mcp",
  "ssh_mcp",
  "sudo_mcp",
  "mariadb",
] as const;

type McpToggleKey = (typeof MCP_TOGGLE_KEYS)[number];

function toVendorMcpName(key: McpToggleKey): string {
  if (key === "web_agent_mcp") {
    return "web-agent-mcp";
  }
  if (key === "pg_mcp") {
    return "pg-mcp";
  }
  if (key === "ssh_mcp") {
    return "ssh-mcp";
  }
  return key;
}

function buildDisabledStatus(id: string): OptionalComponentStatus {
  return {
    id,
    kind: "mcp",
    enabled: false,
    ready: false,
    reason: "Disabled via configuration",
  };
}

function evaluateMcpStatus(
  key: McpToggleKey,
  enabled: boolean,
  config: HarnessConfig,
): OptionalComponentStatus {
  const id = key;
  if (!enabled) {
    return buildDisabledStatus(id);
  }

  const base: OptionalComponentStatus = {
    id,
    kind: "mcp",
    enabled: true,
    ready: false,
  };

  switch (key) {
    case "context7":
    case "grep_app":
    case "websearch":
    case "mariadb":
      base.ready = true;
      break;
    case "fff": {
      const command = resolveFffCommand();
      if (command.length === 0) {
        base.reason = "fff-mcp executable not found in bin directory or PATH.";
        break;
      }
      base.ready = true;
      break;
    }
    case "web_agent_mcp": {
      const name = toVendorMcpName(key);
      const serverRoot = resolveMcpServerRoot(name);
      const serverEntry = join(serverRoot, "src", "server.ts");
      if (!existsSync(serverEntry)) {
        base.reason = `web-agent-mcp server entry missing at ${serverEntry}`;
        break;
      }
      if (!isWebAgentMcpInstalled(serverRoot)) {
        base.reason = "web-agent-mcp dependencies are not installed.";
        break;
      }
      base.ready = true;
      break;
    }
    case "pg_mcp": {
      const name = toVendorMcpName(key);
      const configPath = join(resolveMcpServerRoot(name), "config.json");
      if (!existsSync(configPath)) {
        base.reason = `pg-mcp config missing at ${configPath}`;
        break;
      }
      base.ready = true;
      break;
    }
    case "ssh_mcp": {
      const name = toVendorMcpName(key);
      const configPath = join(resolveMcpServerRoot(name), "config.json");
      if (!existsSync(configPath)) {
        base.reason = `ssh-mcp config missing at ${configPath}`;
        break;
      }
      base.ready = true;
      break;
    }
    case "sudo_mcp": {
      base.reason = "sudo_mcp is not yet supported.";
      break;
    }
    default:
      base.reason = "Unknown MCP toggle state.";
  }

  return base;
}

export function determineOptionalComponentStatuses(
  config: HarnessConfig,
): OptionalComponentStatuses {
  const optional = config.optional_components ?? {};
  const degradeOptionalFailures = config.runtime?.degrade_optional_failures ?? true;
  const root = configRoot();

  const backgroundEnabled = optional.background_agents !== "off";
  const backgroundDir = join(root, "vendor", "opencode-background-agents-local");
  const backgroundEntry = join(backgroundDir, "background-agents.ts");
  let backgroundReason: string | undefined;
  if (!existsSync(backgroundDir)) {
    backgroundReason = `Background agents directory missing at ${backgroundDir}`;
  } else if (!existsSync(backgroundEntry)) {
    backgroundReason = `Background agents entry missing at ${backgroundEntry}`;
  }
  const backgroundReady = backgroundEnabled && !backgroundReason;

  const shellEnabled = optional.shell_strategy !== "off";
  const shellFile = join(root, "plugin", "shell-strategy", "shell_strategy.md");
  const shellReason = !existsSync(shellFile)
    ? `Shell strategy instruction missing at ${shellFile}`
    : undefined;
  const shellReady = shellEnabled && !shellReason;

  const mcps: Record<string, OptionalComponentStatus> = {};
  const toggles = (config.mcps ?? {}) as Record<McpToggleKey, boolean | undefined>;
  for (const key of MCP_TOGGLE_KEYS) {
    const enabled = toggles[key] !== false;
    mcps[key] = evaluateMcpStatus(key, enabled, config);
  }

  return {
    degradeOptionalFailures,
    backgroundAgents: {
      id: "background_agents",
      kind: "background_agents",
      enabled: backgroundEnabled,
      ready: backgroundReady,
      reason: backgroundEnabled ? backgroundReason : "Disabled via configuration",
    },
    shellStrategy: {
      id: "shell_strategy",
      kind: "shell_strategy",
      enabled: shellEnabled,
      ready: shellReady,
      reason: shellEnabled ? shellReason : "Disabled via configuration",
    },
    mcps,
  };
}
