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

export type HooksConfig = {
  profile?: HookProfile;
  session_start?: boolean;
  pre_tool_use?: boolean;
  post_tool_use?: boolean;
  post_tool_use_nudge?: boolean;
  checkpoint_interval?: number;
  stop?: boolean;
  session_end?: boolean;
  phase_reminder?: boolean;
  stuck_threshold?: number;
  todo_continuation?: boolean;
  apply_patch_rescue?: boolean;
  json_error_recovery?: boolean;
  delegate_retry?: boolean;
  delegate_max_retries?: number;
  filter_skills?: boolean;
  chat_headers?: boolean;
};

export type HarnessConfig = {
  schema_version?: number;
  default_mode?: HarnessMode;
  set_default_agent?: boolean;
  ui?: UiConfig;
  commands?: {
    enabled?: boolean;
  };
  hooks?: HooksConfig;
  mcps?: McpToggles;
  agents?: Record<string, AgentOverride>;
  fallbacks?: FallbacksConfig;
  multiplexer?: MultiplexerConfig;
};

export type AgentLike = Record<string, unknown>;
