import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse, type ParseError } from "jsonc-parser";
import { z } from "zod";
import type { HarnessConfig } from "./types";
import { resolveFallbackState } from "./fallbacks";
import { deepMerge, isObject } from "./utils";

export const CURRENT_HARNESS_SCHEMA_VERSION = 2;

export type HarnessConfigSourceSummary = {
  path: string;
  exists: boolean;
  schemaVersion?: number;
  migrationWarnings: string[];
  validationWarnings: string[];
};

export type ResolvedHarnessConfig = {
  effectiveConfig: HarnessConfig;
  schemaVersion: number;
  sources: {
    user: HarnessConfigSourceSummary;
    project: HarnessConfigSourceSummary;
  };
  migrationWarnings: string[];
  validationWarnings: string[];
  userConfig: HarnessConfig;
  projectConfig: HarnessConfig;
  fallbackState: ReturnType<typeof resolveFallbackState>;
};

export type LoadHarnessConfigOptions = {
  userConfigPath?: string;
  projectConfigPath?: string;
};

export type ConfigShowOptions = {
  includeSources?: boolean;
};

const FallbackCandidateSchema = z.object({
  model: z.string().optional(),
  variant: z.string().optional(),
});

export const HarnessConfigSchema = z.object({
  schema_version: z.number().int().positive().optional(),
  default_mode: z.enum(["coordinator"]).optional(),
  set_default_agent: z.boolean().optional(),
  ui: z
    .object({
      worker_visibility: z.enum(["off", "summary", "visible"]).optional(),
    })
    .optional(),
  commands: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  hooks: z
    .object({
      profile: z.enum(["minimal", "standard", "strict"]).optional(),
      session_start: z.boolean().optional(),
      pre_tool_use: z.boolean().optional(),
      post_tool_use: z.boolean().optional(),
      post_tool_use_nudge: z.boolean().optional(),
      checkpoint_interval: z.number().int().positive().optional(),
      stop: z.boolean().optional(),
      session_end: z.boolean().optional(),
      phase_reminder: z.boolean().optional(),
      stuck_threshold: z.number().int().positive().optional(),
      todo_continuation: z.boolean().optional(),
      apply_patch_rescue: z.boolean().optional(),
      json_error_recovery: z.boolean().optional(),
      delegate_retry: z.boolean().optional(),
      delegate_max_retries: z.number().int().positive().optional(),
      filter_skills: z.boolean().optional(),
      chat_headers: z.boolean().optional(),
    })
    .optional(),
  mcps: z
    .object({
      context7: z.boolean().optional(),
      grep_app: z.boolean().optional(),
      websearch: z.boolean().optional(),
    })
    .optional(),
  agents: z
    .record(
      z.string(),
      z.object({
        model: z.string().optional(),
        variant: z.string().optional(),
        description: z.string().optional(),
        prompt_append: z.string().optional(),
      }),
    )
    .optional(),
  fallbacks: z
    .object({
      enabled: z.boolean().optional(),
      coordinator: z.array(FallbackCandidateSchema).optional(),
      verifier: z.array(FallbackCandidateSchema).optional(),
      chains: z.record(z.string(), z.array(z.string())).optional(),
    })
    .optional(),
  multiplexer: z
    .object({
      type: z.enum(["none", "tmux"]).optional(),
      layout: z.enum(["main-horizontal", "main-vertical", "tiled"]).optional(),
      main_pane_size: z.number().int().positive().optional(),
    })
    .optional(),
  memory: z
    .object({
      enabled: z.boolean().optional(),
      dir: z.string().optional(),
      max_learnings: z.number().int().positive().optional(),
      inject_summary: z.boolean().optional(),
    })
    .optional(),
});

const DEFAULTS: HarnessConfig = {
  schema_version: CURRENT_HARNESS_SCHEMA_VERSION,
  default_mode: "coordinator",
  set_default_agent: true,
  ui: { worker_visibility: "visible" },
  commands: { enabled: true },
  hooks: {
    profile: "standard",
    session_start: true,
    pre_tool_use: true,
    post_tool_use: true,
    post_tool_use_nudge: true,
    checkpoint_interval: 10,
    stop: true,
    session_end: true,
    phase_reminder: true,
    stuck_threshold: 5,
    todo_continuation: true,
    apply_patch_rescue: true,
    json_error_recovery: true,
    delegate_retry: true,
    delegate_max_retries: 2,
    filter_skills: true,
    chat_headers: true,
  },
  mcps: {
    context7: true,
    grep_app: true,
    websearch: true,
  },
  agents: {},
  fallbacks: {
    enabled: true,
    coordinator: [],
    verifier: [],
    chains: {},
  },
  multiplexer: {
    type: "none",
    layout: "main-vertical",
    main_pane_size: 60,
  },
  memory: {
    enabled: true,
    dir: ".gladio",
    max_learnings: 100,
    inject_summary: true,
  },
};

const ConfigSectionSchemas = {
  schema_version: HarnessConfigSchema.shape.schema_version,
  default_mode: HarnessConfigSchema.shape.default_mode,
  set_default_agent: HarnessConfigSchema.shape.set_default_agent,
  ui: HarnessConfigSchema.shape.ui,
  commands: HarnessConfigSchema.shape.commands,
  hooks: HarnessConfigSchema.shape.hooks,
  mcps: HarnessConfigSchema.shape.mcps,
  agents: HarnessConfigSchema.shape.agents,
  fallbacks: HarnessConfigSchema.shape.fallbacks,
  multiplexer: HarnessConfigSchema.shape.multiplexer,
  memory: HarnessConfigSchema.shape.memory,
} satisfies Record<keyof HarnessConfig, z.ZodTypeAny>;

function formatParseErrors(errors: ParseError[]): string {
  return errors.map((error) => `offset ${error.offset}: code ${error.error}`).join(", ");
}

function logConfigWarning(filePath: string, message: string): void {
  console.warn(`[opencode-gladio] ${message} (${filePath})`);
}

type ConfigParseResult = {
  config: HarnessConfig;
  validationWarnings: string[];
};

function parseConfigPartially(parsed: unknown, filePath: string): ConfigParseResult {
  const warnings: string[] = [];
  if (!isObject(parsed)) {
    const message = "Ignoring config because it is not an object";
    logConfigWarning(filePath, message);
    warnings.push(message);
    return { config: {}, validationWarnings: warnings };
  }

  const partial: Partial<HarnessConfig> = {};
  const invalidSections: string[] = [];

  for (const [key, schema] of Object.entries(ConfigSectionSchemas) as Array<
    [keyof HarnessConfig, z.ZodTypeAny]
  >) {
    if (!(key in parsed)) continue;
    const result = schema.safeParse(parsed[key]);
    if (result.success) {
      (partial as Record<string, unknown>)[key] = result.data;
      continue;
    }
    invalidSections.push(
      `${key}: ${result.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }

  if (invalidSections.length > 0) {
    const message = `Partially loaded config. Ignored invalid sections:\n- ${invalidSections.join("\n- ")}`;
    logConfigWarning(filePath, message);
    warnings.push(message);
  }

  return { config: partial, validationWarnings: warnings };
}

function parseConfigSafely(parsed: unknown, filePath: string): ConfigParseResult {
  const result = HarnessConfigSchema.safeParse(parsed);
  if (result.success) {
    return { config: result.data, validationWarnings: [] };
  }
  return parseConfigPartially(parsed, filePath);
}

type ConfigFileState = {
  path: string;
  exists: boolean;
  config: HarnessConfig;
  schemaVersion?: number;
  migrationWarnings: string[];
  validationWarnings: string[];
};

function loadConfigSource(filePath: string): ConfigFileState {
  if (!existsSync(filePath)) {
    return {
      path: filePath,
      exists: false,
      config: {},
      schemaVersion: undefined,
      migrationWarnings: [],
      validationWarnings: [],
    };
  }

  const raw = readFileSync(filePath, "utf8");
  const errors: ParseError[] = [];
  const parsed = parse(raw, errors);
  if (errors.length > 0) {
    const message =
      "Ignoring unreadable JSONC config with parse errors: " + formatParseErrors(errors);
    logConfigWarning(filePath, message);
    return {
      path: filePath,
      exists: true,
      config: {},
      schemaVersion: undefined,
      migrationWarnings: [],
      validationWarnings: [message],
    };
  }

  const parseResult = parseConfigSafely(parsed, filePath);
  const migrationResult = migrateHarnessConfig(parseResult.config, filePath);

  return {
    path: filePath,
    exists: true,
    config: migrationResult.config,
    schemaVersion: migrationResult.config.schema_version,
    migrationWarnings: migrationResult.warnings,
    validationWarnings: parseResult.validationWarnings,
  };
}

function buildSourceSummary(state: ConfigFileState): HarnessConfigSourceSummary {
  return {
    path: state.path,
    exists: state.exists,
    schemaVersion: state.schemaVersion,
    migrationWarnings: state.migrationWarnings,
    validationWarnings: state.validationWarnings,
  };
}

export function migrateHarnessConfig(
  config: HarnessConfig,
  filePath: string,
): { config: HarnessConfig; warnings: string[] } {
  const warnings: string[] = [];
  const migrated: HarnessConfig = { ...config };
  const version = migrated.schema_version;

  if (version === undefined) {
    const message = `Missing schema_version. Assuming current schema version ${CURRENT_HARNESS_SCHEMA_VERSION}.`;
    logConfigWarning(filePath, message);
    warnings.push(message);
    migrated.schema_version = CURRENT_HARNESS_SCHEMA_VERSION;
    return { config: migrated, warnings };
  }

  if (version > CURRENT_HARNESS_SCHEMA_VERSION) {
    const message = `Config schema_version ${version} is newer than supported ${CURRENT_HARNESS_SCHEMA_VERSION}. Proceeding with partial compatibility.`;
    logConfigWarning(filePath, message);
    warnings.push(message);
  }

  return { config: migrated, warnings };
}

export function loadResolvedHarnessConfig(
  projectDirectory: string,
  options?: LoadHarnessConfigOptions,
): ResolvedHarnessConfig {
  const userPath =
    options?.userConfigPath ?? join(homedir(), ".config", "opencode", "opencode-gladio.jsonc");
  const userState = loadConfigSource(userPath);
  const effectiveConfig = deepMerge(DEFAULTS, userState.config);
  const schemaVersion = effectiveConfig.schema_version ?? CURRENT_HARNESS_SCHEMA_VERSION;
  const fallbackState = resolveFallbackState(effectiveConfig);

  return {
    effectiveConfig,
    schemaVersion,
    sources: {
      user: buildSourceSummary(userState),
      project: {
        path: join(projectDirectory, ".opencode", "opencode-gladio.jsonc"),
        exists: false,
        schemaVersion: undefined,
        migrationWarnings: [],
        validationWarnings: [],
      },
    },
    migrationWarnings: [...userState.migrationWarnings],
    validationWarnings: [...userState.validationWarnings],
    userConfig: userState.config,
    projectConfig: {},
    fallbackState,
  };
}

export function buildConfigShowJson(
  resolved: ResolvedHarnessConfig,
  options?: ConfigShowOptions,
): Record<string, unknown> {
  return {
    schemaVersion: resolved.schemaVersion,
    effectiveConfig: resolved.effectiveConfig,
    migrationWarnings: resolved.migrationWarnings,
    validationWarnings: resolved.validationWarnings,
    fallbackState: resolved.fallbackState,
    ...(options?.includeSources ? { sources: resolved.sources } : {}),
  };
}

export function maskHarnessConfigSecrets(config: HarnessConfig): HarnessConfig {
  return config;
}

export function buildConfigSourceAttribution(_resolved?: unknown): Record<string, unknown> {
  return {};
}

export function formatConfigShowText(
  resolved: ResolvedHarnessConfig,
  options?: ConfigShowOptions,
): string {
  const lines: string[] = [];
  lines.push(`Schema version: ${resolved.schemaVersion}`);
  lines.push(`Config: ${resolved.sources.user.path} (${resolved.sources.user.exists ? "exists" : "missing"})`);
  lines.push("");
  lines.push("Effective config:");
  lines.push(JSON.stringify(resolved.effectiveConfig, null, 2));
  if (resolved.validationWarnings.length > 0) {
    lines.push("", "Validation warnings:");
    for (const warning of resolved.validationWarnings) lines.push(`- ${warning}`);
  }
  if (resolved.migrationWarnings.length > 0) {
    lines.push("", "Migration warnings:");
    for (const warning of resolved.migrationWarnings) lines.push(`- ${warning}`);
  }
  lines.push("", "Agent fallback state:");
  lines.push(JSON.stringify(resolved.fallbackState, null, 2));
  if (options?.includeSources) {
    lines.push("", "Sources:");
    lines.push(JSON.stringify(resolved.sources, null, 2));
  }
  return lines.join("\n");
}

export function loadHarnessConfig(projectDirectory: string): HarnessConfig {
  return loadResolvedHarnessConfig(projectDirectory).effectiveConfig;
}

export const SAMPLE_PROJECT_CONFIG = `{
  "schema_version": ${CURRENT_HARNESS_SCHEMA_VERSION},
  "default_mode": "coordinator",
  "ui": {
    "worker_visibility": "visible"
  },
  "hooks": {
    "profile": "standard",
    "session_start": true,
    "pre_tool_use": true,
    "post_tool_use": true,
    "post_tool_use_nudge": true,
    "checkpoint_interval": 10,
    "stop": true,
    "session_end": true,
    "phase_reminder": true,
    "stuck_threshold": 5,
    "todo_continuation": true,
    "apply_patch_rescue": true,
    "json_error_recovery": true,
    "delegate_retry": true,
    "delegate_max_retries": 2,
    "filter_skills": true,
    "chat_headers": true
  },
  "mcps": {
    "context7": true,
    "grep_app": true,
    "websearch": true
  },
  "fallbacks": {
    "enabled": true,
    "chains": {}
  },
  "multiplexer": {
    "type": "none",
    "layout": "main-vertical",
    "main_pane_size": 60
  },
  "agents": {},
  "memory": {
    "enabled": true,
    "dir": ".gladio",
    "max_learnings": 100,
    "inject_summary": true
  }
}`;
