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

export type WorkerVisibilityMode = "off" | "summary" | "visible";

export type UiConfig = {
  worker_visibility?: WorkerVisibilityMode;
};

export type McpToggles = {
  context7?: boolean;
  grep_app?: boolean;
  websearch?: boolean;
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

export type FallbackCandidateConfig = {
  model?: string;
  variant?: string;
};

export type FallbacksConfig = {
  enabled?: boolean;
  coordinator?: FallbackCandidateConfig[];
  verifier?: FallbackCandidateConfig[];
  chains?: Record<string, string[]>;
};

export type AgentOverride = {
  model?: string;
  variant?: string;
  description?: string;
  prompt_append?: string;
};

export type MultiplexerConfig = {
  type?: "none" | "tmux";
  layout?: "main-horizontal" | "main-vertical" | "tiled";
  main_pane_size?: number;
};

export type TokenBudgetConfig = {
  enabled?: boolean;
  agentOverrides?: Record<string, { promptChars?: number; compactThreshold?: number; compactRepeat?: number }>;
  globalCompactThreshold?: number;
};

export type HarnessConfig = {
  token_budget?: TokenBudgetConfig;
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
  mcps?: McpToggles;
  agents?: Record<string, AgentOverride>;
  fallbacks?: FallbacksConfig;
  multiplexer?: MultiplexerConfig;
};

export type AgentLike = Record<string, unknown>;
