import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse, type ParseError } from "jsonc-parser";
import { z } from "zod";
import type { HarnessConfig, OptionalComponentStatuses } from "./types";
import { determineOptionalComponentStatuses } from "./optional-components";
import { deepMerge, isObject } from "./utils";
import { DEFAULT_FALLBACK_CONFIG, resolveFallbackState } from "./fallbacks";
import type { ResolvedFallbackState } from "./fallbacks";

export const CURRENT_HARNESS_SCHEMA_VERSION = 1;

export type HarnessConfigSourceSummary = {
  path: string;
  exists: boolean;
  schemaVersion?: number;
  migrationWarnings: string[];
  validationWarnings: string[];
};

export type LoadHarnessConfigOptions = {
  userConfigPath?: string;
  projectConfigPath?: string;
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
  optionalComponentStatus: OptionalComponentStatuses;
  fallbackState: ResolvedFallbackState;
};

export type ConfigSource = "default" | "user" | "project";

export interface ConfigSourceMap {
  [key: string]: ConfigSource | ConfigSourceMap;
}

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
      comment_guard: z.boolean().optional(),
      session_start: z.boolean().optional(),
      pre_tool_use: z.boolean().optional(),
      post_tool_use: z.boolean().optional(),
      pre_compact: z.boolean().optional(),
      stop: z.boolean().optional(),
      session_end: z.boolean().optional(),
      file_edited: z.boolean().optional(),
      prompt_refiner: z.boolean().optional(),
    })
    .optional(),
  memory: z
    .object({
      enabled: z.boolean().optional(),
      directory: z.string().optional(),
      lookback_days: z.number().int().positive().optional(),
      max_injected_chars: z.number().int().positive().optional(),
    })
    .optional(),
  learning: z
    .object({
      enabled: z.boolean().optional(),
      directory: z.string().optional(),
      min_observations: z.number().int().positive().optional(),
      auto_promote: z.boolean().optional(),
      max_patterns: z.number().int().positive().optional(),
      max_injected_patterns: z.number().int().positive().optional(),
    })
    .optional(),
  optional_components: z
    .object({
      background_agents: z.enum(["auto", "off"]).optional(),
      shell_strategy: z.enum(["auto", "off"]).optional(),
    })
    .optional(),
  runtime: z
    .object({
      degrade_optional_failures: z.boolean().optional(),
    })
    .optional(),
  mcps: z
    .object({
      context7: z.boolean().optional(),
      grep_app: z.boolean().optional(),
      websearch: z.boolean().optional(),
      fff: z.boolean().optional(),
      web_agent_mcp: z.boolean().optional(),
      pg_mcp: z.boolean().optional(),
      ssh_mcp: z.boolean().optional(),
      sudo_mcp: z.boolean().optional(),
      mariadb: z.boolean().optional(),
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
      coordinator: z.array(FallbackCandidateSchema).optional(),
      verifier: z.array(FallbackCandidateSchema).optional(),
    })
    .optional(),
});


const DEFAULTS: HarnessConfig = {
  schema_version: CURRENT_HARNESS_SCHEMA_VERSION,
  default_mode: "coordinator",
  set_default_agent: true,
  ui: {
    worker_visibility: "visible",
  },
  commands: {
    enabled: true,
  },
  hooks: {
    profile: "standard",
    comment_guard: true,
    session_start: true,
    pre_tool_use: true,
    post_tool_use: true,
    pre_compact: true,
    stop: true,
    session_end: true,
    file_edited: true,
    prompt_refiner: false,
  },
  memory: {
    enabled: true,
    lookback_days: 7,
    max_injected_chars: 3500,
  },
  learning: {
    enabled: true,
    min_observations: 6,
    auto_promote: true,
    max_patterns: 24,
    max_injected_patterns: 5,
  },
  optional_components: {
    background_agents: "auto",
    shell_strategy: "auto",
  },
  runtime: {
    degrade_optional_failures: true,
  },
  mcps: {
    context7: true,
    grep_app: true,
    websearch: true,
    fff: true,
    web_agent_mcp: true,
    pg_mcp: true,
    ssh_mcp: true,
    sudo_mcp: false,
    mariadb: true,
  },
  agents: {},
  fallbacks: DEFAULT_FALLBACK_CONFIG,
};

const ConfigSectionSchemas = {
  schema_version: HarnessConfigSchema.shape.schema_version,
  default_mode: HarnessConfigSchema.shape.default_mode,
  set_default_agent: HarnessConfigSchema.shape.set_default_agent,
  ui: HarnessConfigSchema.shape.ui,
  commands: HarnessConfigSchema.shape.commands,
  hooks: HarnessConfigSchema.shape.hooks,
  memory: HarnessConfigSchema.shape.memory,
  learning: HarnessConfigSchema.shape.learning,
  optional_components: HarnessConfigSchema.shape.optional_components,
  runtime: HarnessConfigSchema.shape.runtime,
  mcps: HarnessConfigSchema.shape.mcps,
  agents: HarnessConfigSchema.shape.agents,
  fallbacks: HarnessConfigSchema.shape.fallbacks,
} satisfies Record<keyof HarnessConfig, z.ZodTypeAny>;

function formatParseErrors(errors: ParseError[]): string {
  return errors
    .map((error) => `offset ${error.offset}: code ${error.error}`)
    .join(", ");
}

function logConfigWarning(filePath: string, message: string): void {
  console.warn(`[opencode-gladio] ${message} (${filePath})`);
}

type ConfigParseResult = {
  config: HarnessConfig;
  validationWarnings: string[];
};

function parseConfigPartially(
  parsed: unknown,
  filePath: string,
): ConfigParseResult {
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
    if (!(key in parsed)) {
      continue;
    }

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
      "Ignoring unreadable JSONC config with parse errors: " +
      formatParseErrors(errors);
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
    const message =
      "Missing schema_version. Assuming current schema version " +
      CURRENT_HARNESS_SCHEMA_VERSION +
      ".";
    logConfigWarning(filePath, message);
    warnings.push(message);
    migrated.schema_version = CURRENT_HARNESS_SCHEMA_VERSION;
    return { config: migrated, warnings };
  }

  if (version > CURRENT_HARNESS_SCHEMA_VERSION) {
    const message =
      `Config schema_version ${version} is newer than supported ` +
      `${CURRENT_HARNESS_SCHEMA_VERSION}. Proceeding with partial compatibility.`;
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
    options?.userConfigPath ??
    join(homedir(), ".config", "opencode", "opencode-gladio.jsonc");
  const projectPath =
    options?.projectConfigPath ??
    join(projectDirectory, ".opencode", "opencode-gladio.jsonc");

  const userState = loadConfigSource(userPath);
  const projectState = loadConfigSource(projectPath);

  const withUser = deepMerge(DEFAULTS, userState.config);
  const effectiveConfig = deepMerge(withUser, projectState.config);
  const schemaVersion = effectiveConfig.schema_version ?? CURRENT_HARNESS_SCHEMA_VERSION;
  const optionalComponentStatus = determineOptionalComponentStatuses(effectiveConfig);
  const fallbackState = resolveFallbackState(effectiveConfig);

  return {
    effectiveConfig,
    schemaVersion,
    sources: {
      user: buildSourceSummary(userState),
      project: buildSourceSummary(projectState),
    },
    migrationWarnings: [...userState.migrationWarnings, ...projectState.migrationWarnings],
    validationWarnings: [...userState.validationWarnings, ...projectState.validationWarnings],
    userConfig: userState.config,
    projectConfig: projectState.config,
    optionalComponentStatus,
    fallbackState,
  };
}

const SECRET_MASK = "*****";
const SECRET_PATHS: string[][] = [];

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }

  if (isObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = cloneValue(entry);
    }
    return result;
  }

  return value;
}

function maskValueAtPath(target: Record<string, unknown>, path: string[]): void {
  let current: Record<string, unknown> | undefined = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const next: unknown = current ? current[segment] : undefined;
    if (!isObject(next)) {
      current = undefined;
      break;
    }
    current = next;
  }

  if (!current) {
    return;
  }

  const last = path[path.length - 1];
  if (Object.prototype.hasOwnProperty.call(current, last)) {
    current[last] = SECRET_MASK;
  }
}

export function maskHarnessConfigSecrets(config: HarnessConfig): HarnessConfig {
  const cloned = cloneValue(config) as HarnessConfig;
  for (const path of SECRET_PATHS) {
    maskValueAtPath(cloned, path);
  }
  return cloned;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isObject(value) ? value : undefined;
}

function addKeys(source: Record<string, unknown> | undefined, keys: Set<string>): void {
  if (!source) {
    return;
  }

  for (const key of Object.keys(source)) {
    keys.add(key);
  }
}

function hasOwnKey(record: Record<string, unknown> | undefined, key: string): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
}

function buildSourceAttributionNode(
  effective: Record<string, unknown>,
  user: Record<string, unknown> | undefined,
  project: Record<string, unknown> | undefined,
  defaults: Record<string, unknown> | undefined,
): ConfigSourceMap {
  const keys = new Set<string>();
  addKeys(effective, keys);
  addKeys(user, keys);
  addKeys(project, keys);
  addKeys(defaults, keys);

  const result: ConfigSourceMap = {};
  for (const key of keys) {
    result[key] = buildSourceForKey(key, effective, user, project, defaults);
  }

  return result;
}

function buildSourceForKey(
  key: string,
  effectiveParent: Record<string, unknown>,
  userParent: Record<string, unknown> | undefined,
  projectParent: Record<string, unknown> | undefined,
  defaultParent: Record<string, unknown> | undefined,
): ConfigSource | ConfigSourceMap {
  const effectiveValue = effectiveParent[key];
  const userValue = userParent ? userParent[key] : undefined;
  const projectValue = projectParent ? projectParent[key] : undefined;
  const defaultValue = defaultParent ? defaultParent[key] : undefined;

  const nestedEffective = toRecord(effectiveValue);
  const nestedUser = toRecord(userValue);
  const nestedProject = toRecord(projectValue);
  const nestedDefault = toRecord(defaultValue);

  if (nestedEffective || nestedUser || nestedProject || nestedDefault) {
    const nextEffective =
      nestedEffective ?? nestedProject ?? nestedUser ?? nestedDefault ?? {};
    const nextUser = nestedUser ?? undefined;
    const nextProject = nestedProject ?? undefined;
    const nextDefault = nestedDefault ?? undefined;
    return buildSourceAttributionNode(nextEffective, nextUser, nextProject, nextDefault);
  }

  if (hasOwnKey(projectParent, key)) {
    return "project";
  }

  if (hasOwnKey(userParent, key)) {
    return "user";
  }

  return "default";
}

export function buildConfigSourceAttribution(
  resolved: ResolvedHarnessConfig,
): ConfigSourceMap {
  const effectiveRecord = toRecord(resolved.effectiveConfig) ?? {};
  const userRecord = toRecord(resolved.userConfig);
  const projectRecord = toRecord(resolved.projectConfig);
  const defaultRecord = toRecord(DEFAULTS);

  return buildSourceAttributionNode(
    effectiveRecord,
    userRecord,
    projectRecord,
    defaultRecord,
  );
}

export function buildConfigShowJson(
  resolved: ResolvedHarnessConfig,
  options?: ConfigShowOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    schemaVersion: resolved.schemaVersion,
    sources: resolved.sources,
    effectiveConfig: maskHarnessConfigSecrets(resolved.effectiveConfig),
    migrationWarnings: resolved.migrationWarnings,
    validationWarnings: resolved.validationWarnings,
    optionalComponents: resolved.optionalComponentStatus,
    fallbackState: resolved.fallbackState,
  };

  if (options?.includeSources) {
    payload.sourceAttribution = buildConfigSourceAttribution(resolved);
  }

  return payload;
}

export function formatConfigShowText(
  resolved: ResolvedHarnessConfig,
  options?: ConfigShowOptions,
): string {
  const maskedConfig = maskHarnessConfigSecrets(resolved.effectiveConfig);
  const lines: string[] = [];
  lines.push(`Schema version: ${resolved.schemaVersion}`);
  lines.push(
    `User config: ${resolved.sources.user.path} (${resolved.sources.user.exists ? "exists" : "missing"})`,
  );
  lines.push(
    `Project config: ${resolved.sources.project.path} (${resolved.sources.project.exists ? "exists" : "missing"})`,
  );
  lines.push("");
  lines.push("Effective config (secrets masked):");
  lines.push(JSON.stringify(maskedConfig, null, 2));

  if (resolved.migrationWarnings.length > 0) {
    lines.push("");
    lines.push("Migration warnings:");
    for (const warning of resolved.migrationWarnings) {
      lines.push(`- ${warning}`);
    }
  }

  if (resolved.validationWarnings.length > 0) {
    lines.push("");
    lines.push("Validation warnings:");
    for (const warning of resolved.validationWarnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("");
  lines.push("Optional component readiness:");
  lines.push(JSON.stringify(resolved.optionalComponentStatus, null, 2));

  lines.push("");
  lines.push("Agent fallback state:");
  lines.push(JSON.stringify(resolved.fallbackState, null, 2));

  if (options?.includeSources) {
    lines.push("");
    lines.push("Source attribution:");
    lines.push(JSON.stringify(buildConfigSourceAttribution(resolved), null, 2));
  }

  return lines.join("\n");
}

export function loadHarnessConfig(projectDirectory: string): HarnessConfig {
  return loadResolvedHarnessConfig(projectDirectory).effectiveConfig;
}

export const SAMPLE_PROJECT_CONFIG = `{
  // Project-level overrides for opencode-gladio
  "schema_version": ${CURRENT_HARNESS_SCHEMA_VERSION},
  "default_mode": "coordinator",
  "ui": {
    "worker_visibility": "visible"
  },
  "hooks": {
    "profile": "standard",
    "comment_guard": true,
    "session_start": true,
    "pre_tool_use": true,
    "post_tool_use": true,
    "pre_compact": true,
    "stop": true,
    "session_end": true,
    "file_edited": true,
    "prompt_refiner": false
  },
  "memory": {
    "enabled": true,
    "lookback_days": 7,
    "max_injected_chars": 3500
  },
  "learning": {
    "enabled": true,
    "min_observations": 6,
    "auto_promote": true,
    "max_patterns": 24,
    "max_injected_patterns": 5
  },
  "optional_components": {
    "background_agents": "auto",
    "shell_strategy": "auto"
  },
  "runtime": {
    "degrade_optional_failures": true
  },
  "mcps": {
    "context7": true,
    "grep_app": true,
    "websearch": true,
    "fff": true,
    "web_agent_mcp": true,
    "pg_mcp": true,
    "ssh_mcp": true,
    "sudo_mcp": false,
    "mariadb": true
  },
  "agents": {}
}`;
