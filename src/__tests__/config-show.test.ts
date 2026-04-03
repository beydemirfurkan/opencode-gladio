import { describe, expect, it } from "bun:test";
import {
  buildConfigShowJson,
  buildConfigSourceAttribution,
  ConfigSourceMap,
  CURRENT_HARNESS_SCHEMA_VERSION,
  formatConfigShowText,
  maskHarnessConfigSecrets,
  ResolvedHarnessConfig,
} from "../config";
import type { HarnessConfig, OptionalComponentStatuses } from "../types";
import { resolveFallbackState } from "../fallbacks";

const baseEffectiveConfig: HarnessConfig = {
  schema_version: CURRENT_HARNESS_SCHEMA_VERSION,
  default_mode: "coordinator",
  set_default_agent: true,
  hooks: {
    profile: "strict",
    session_start: false,
  },
  memory: {
    enabled: false,
    lookback_days: 7,
    max_injected_chars: 3500,
  },
};

const baseResolved: ResolvedHarnessConfig = {
  effectiveConfig: baseEffectiveConfig,
  schemaVersion: CURRENT_HARNESS_SCHEMA_VERSION,
  sources: {
    user: {
      path: "/tmp/user-config",
      exists: true,
      schemaVersion: CURRENT_HARNESS_SCHEMA_VERSION,
      migrationWarnings: [],
      validationWarnings: [],
    },
    project: {
      path: "/tmp/project-config",
      exists: true,
      schemaVersion: CURRENT_HARNESS_SCHEMA_VERSION,
      migrationWarnings: [],
      validationWarnings: [],
    },
  },
  migrationWarnings: ["migration-1"],
  validationWarnings: ["validation-1"],
  userConfig: {
    hooks: {
      profile: "standard",
    },
  },
  projectConfig: {
    hooks: {
      profile: "strict",
      session_start: false,
    },
    memory: {
      enabled: false,
    },
  },
  optionalComponentStatus: {
    degradeOptionalFailures: true,
    backgroundAgents: {
      id: "background_agents",
      kind: "background_agents",
      enabled: true,
      ready: true,
    },
    shellStrategy: {
      id: "shell_strategy",
      kind: "shell_strategy",
      enabled: true,
      ready: true,
    },
    mcps: {
      context7: {
        id: "context7",
        kind: "mcp",
        enabled: true,
        ready: true,
      },
    },
  },
  fallbackState: resolveFallbackState(baseEffectiveConfig),
};

describe("Config show helpers", () => {
  it("maskHarnessConfigSecrets returns config unchanged when no secrets present", () => {
    const masked = maskHarnessConfigSecrets(baseResolved.effectiveConfig);
    expect(masked.hooks?.profile).toBe("strict");
  });

  it("derives key-level source attribution", () => {
    const attribution = buildConfigSourceAttribution(baseResolved);
    const hooks = attribution.hooks as ConfigSourceMap;
    const memory = attribution.memory as ConfigSourceMap;

    expect(hooks.profile).toBe("project");
    expect(hooks.session_start).toBe("project");
    expect(memory.enabled).toBe("project");
  });

  it("includes warnings and optional source details in text output", () => {
    const text = formatConfigShowText(baseResolved, { includeSources: true });
    expect(text).toContain("Migration warnings:");
    expect(text).toContain("Validation warnings:");
    expect(text).toContain("Source attribution:");
    expect(text).toContain("Optional component readiness:");
    expect(text).toContain("Agent fallback state:");
  });

  it("builds JSON payload with masked config and optional attribution", () => {
    const payload = buildConfigShowJson(baseResolved);
    expect(payload.sourceAttribution).toBeUndefined();
    const optional = payload.optionalComponents as OptionalComponentStatuses;
    expect(optional.backgroundAgents.ready).toBe(true);
    expect(optional.mcps.context7.ready).toBe(true);

    const fallbackState = payload.fallbackState as Record<string, unknown>;
    expect(fallbackState).toBeDefined();

    const withSources = buildConfigShowJson(baseResolved, { includeSources: true });
    expect(withSources.sourceAttribution).toBeDefined();
  });
});
