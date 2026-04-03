export type HarnessMode = "coordinator";

export type WorkerType =
  | "cakir"
  | "memati"
  | "abdulhey"
  | "aslan-akbey"
  | "iskender"
  | "tuncay"
  | "halit"
  | "gullu-erhan"
  | "laz-ziya"
  | "pala";

export type HookProfile = "minimal" | "standard" | "strict";

export type WslState = {
  enabled: boolean;
  winDrive: string;
  winProjectPath: string;
};

export type ResourceMap = {
  sshHosts: string[];
  dbConnections: { mariadb: string[]; postgres: string[] };
  projectDocs: string[];
  skills: string[];
};

export type McpToggles = {
  context7?: boolean;
  grep_app?: boolean;
  websearch?: boolean;
  fff?: boolean;
  web_agent_mcp?: boolean;
  pg_mcp?: boolean;
  ssh_mcp?: boolean;
  sudo_mcp?: boolean;
  mariadb?: boolean;
};

export type RuntimeConfig = {
  degrade_optional_failures?: boolean;
};

export type WorkerVisibilityMode = "off" | "summary" | "visible";

export type UiConfig = {
  worker_visibility?: WorkerVisibilityMode;
};

export type OptionalComponentsConfig = {
  background_agents?: "auto" | "off";
  shell_strategy?: "auto" | "off";
};

export type FallbackCandidateConfig = {
  model?: string;
  variant?: string;
};

export type FallbacksConfig = {
  coordinator?: FallbackCandidateConfig[];
  verifier?: FallbackCandidateConfig[];
};

export type OptionalComponentKind = "background_agents" | "shell_strategy" | "mcp";

export type OptionalComponentStatus = {
  id: string;
  kind: OptionalComponentKind;
  enabled: boolean;
  ready: boolean;
  reason?: string;
};

export type OptionalComponentStatuses = {
  degradeOptionalFailures: boolean;
  backgroundAgents: OptionalComponentStatus;
  shellStrategy: OptionalComponentStatus;
  mcps: Record<string, OptionalComponentStatus>;
};

export type AgentOverride = {
  model?: string;
  variant?: string;
  description?: string;
  prompt_append?: string;
};

export type HarnessConfig = {
  schema_version?: number;
  default_mode?: HarnessMode;
  set_default_agent?: boolean;
  ui?: UiConfig;
  commands?: {
    enabled?: boolean;
  };
  hooks?: {
    profile?: HookProfile;
    comment_guard?: boolean;
    session_start?: boolean;
    pre_tool_use?: boolean;
    post_tool_use?: boolean;
    pre_compact?: boolean;
    stop?: boolean;
    session_end?: boolean;
    file_edited?: boolean;
    prompt_refiner?: boolean;
  };
  memory?: {
    enabled?: boolean;
    directory?: string;
    lookback_days?: number;
    max_injected_chars?: number;
  };
  learning?: {
    enabled?: boolean;
    directory?: string;
    min_observations?: number;
    auto_promote?: boolean;
    max_patterns?: number;
    max_injected_patterns?: number;
  };
  mcps?: McpToggles;
  agents?: Record<string, AgentOverride>;
  runtime?: RuntimeConfig;
  optional_components?: OptionalComponentsConfig;
  fallbacks?: FallbacksConfig;
};

export type AgentLike = Record<string, unknown>;
