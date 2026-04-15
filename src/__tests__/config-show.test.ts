import { describe, expect, it } from "bun:test";
import {
  buildConfigShowJson,
  buildConfigSourceAttribution,
  CURRENT_HARNESS_SCHEMA_VERSION,
  formatConfigShowText,
  maskHarnessConfigSecrets,
  type ResolvedHarnessConfig,
} from "../config";
import type { HarnessConfig } from "../types";
import { resolveFallbackState } from "../fallbacks";

const baseEffectiveConfig: HarnessConfig = {
  schema_version: CURRENT_HARNESS_SCHEMA_VERSION,
  default_mode: "coordinator",
  set_default_agent: true,
  hooks: {
    profile: "strict",
    session_start: false,
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
      exists: false,
      schemaVersion: undefined,
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
  projectConfig: {},
  fallbackState: resolveFallbackState(baseEffectiveConfig),
};

describe("Config show helpers", () => {
  it("maskHarnessConfigSecrets returns config unchanged when no secrets present", () => {
    const masked = maskHarnessConfigSecrets(baseResolved.effectiveConfig);
    expect(masked.hooks?.profile).toBe("strict");
  });

  it("buildConfigSourceAttribution returns empty object", () => {
    const attribution = buildConfigSourceAttribution(baseResolved);
    expect(attribution).toEqual({});
  });

  it("includes warnings in text output", () => {
    const text = formatConfigShowText(baseResolved, { includeSources: true });
    expect(text).toContain("Migration warnings:");
    expect(text).toContain("Validation warnings:");
    expect(text).toContain("Agent fallback state:");
  });

  it("builds JSON payload with fallback state", () => {
    const payload = buildConfigShowJson(baseResolved);
    expect(payload.sourceAttribution).toBeUndefined();

    const fallbackState = payload.fallbackState as Record<string, unknown>;
    expect(fallbackState).toBeDefined();

    const withSources = buildConfigShowJson(baseResolved, { includeSources: true });
    expect(withSources.sources).toBeDefined();
  });
});
