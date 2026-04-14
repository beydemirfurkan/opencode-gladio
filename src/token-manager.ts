import type { HarnessConfig } from "./types";

export type AgentTokenBudget = {
  promptChars: number;
  compactThreshold: number;
  compactRepeat: number;
};

const DEFAULT_BUDGETS: Record<string, AgentTokenBudget> = {
  polat: { promptChars: 8000, compactThreshold: 80_000, compactRepeat: 30_000 },
  cakir: { promptChars: 4000, compactThreshold: 50_000, compactRepeat: 20_000 },
  memati: { promptChars: 5000, compactThreshold: 60_000, compactRepeat: 25_000 },
  abdulhey: { promptChars: 3000, compactThreshold: 50_000, compactRepeat: 20_000 },
  "aslan-akbey": { promptChars: 4000, compactThreshold: 50_000, compactRepeat: 20_000 },
  iskender: { promptChars: 4000, compactThreshold: 50_000, compactRepeat: 20_000 },
  tuncay: { promptChars: 3000, compactThreshold: 40_000, compactRepeat: 15_000 },
  halit: { promptChars: 2000, compactThreshold: 40_000, compactRepeat: 15_000 },
  "gullu-erhan": { promptChars: 5000, compactThreshold: 60_000, compactRepeat: 25_000 },
  "laz-ziya": { promptChars: 2000, compactThreshold: 30_000, compactRepeat: 15_000 },
  pala: { promptChars: 3000, compactThreshold: 50_000, compactRepeat: 20_000 },
};

const FALLBACK_BUDGET: AgentTokenBudget = {
  promptChars: 4000,
  compactThreshold: 50_000,
  compactRepeat: 20_000,
};

export function getAgentBudget(agentName: string): AgentTokenBudget {
  return DEFAULT_BUDGETS[agentName] ?? FALLBACK_BUDGET;
}

export type SessionTokenState = {
  estimatedTokens: number;
  toolCount: number;
  lastCompactAt: number;
  inputTokens: number;
  outputTokens: number;
};

export type PruningRule = {
  kind: "drop_old_tool_outputs" | "summarize_worker_output" | "drop_duplicate_reads";
  priority: number;
  description: string;
};

const PRUNING_RULES: PruningRule[] = [
  {
    kind: "drop_duplicate_reads",
    priority: 1,
    description: "Drop repeated file reads of the same path, keep the latest only.",
  },
  {
    kind: "drop_old_tool_outputs",
    priority: 2,
    description: "Truncate tool outputs older than 10 tool-calls to a 2-line summary.",
  },
  {
    kind: "summarize_worker_output",
    priority: 3,
    description: "Summarize completed worker outputs to key findings only.",
  },
];

export function getPruningRules(): PruningRule[] {
  return [...PRUNING_RULES].sort((a, b) => a.priority - b.priority);
}

export type TokenBudgetConfig = {
  enabled?: boolean;
  agentOverrides?: Partial<Record<string, Partial<AgentTokenBudget>>>;
  globalCompactThreshold?: number;
};

export function resolveTokenBudgetConfig(config: HarnessConfig): TokenBudgetConfig {
  const tc = (config as Record<string, unknown>).token_budget;
  if (!tc || typeof tc !== "object") return { enabled: true };
  return tc as TokenBudgetConfig;
}

export function resolveEffectiveBudget(
  agentName: string,
  config: TokenBudgetConfig,
): AgentTokenBudget {
  const base = { ...getAgentBudget(agentName) };
  const override = config.agentOverrides?.[agentName];
  if (override) {
    if (override.promptChars !== undefined) base.promptChars = override.promptChars;
    if (override.compactThreshold !== undefined) base.compactThreshold = override.compactThreshold;
    if (override.compactRepeat !== undefined) base.compactRepeat = override.compactRepeat;
  }
  if (config.globalCompactThreshold !== undefined) {
    base.compactThreshold = config.globalCompactThreshold;
  }
  return base;
}

export type SessionTokenReport = {
  sessionID: string;
  agent?: string;
  estimatedTokens: number;
  inputTokens: number;
  outputTokens: number;
  toolCount: number;
  budget: AgentTokenBudget;
  budgetRemaining: number;
  budgetPercentUsed: number;
  shouldCompact: boolean;
};

export class TokenManager {
  private sessions = new Map<string, SessionTokenState>();
  private config: TokenBudgetConfig;

  constructor(config: TokenBudgetConfig) {
    this.config = config.enabled !== false ? config : { enabled: false };
  }

  isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  getOrCreate(sessionID: string): SessionTokenState {
    const existing = this.sessions.get(sessionID);
    if (existing) return existing;
    const state: SessionTokenState = {
      estimatedTokens: 0,
      toolCount: 0,
      lastCompactAt: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    this.sessions.set(sessionID, state);
    return state;
  }

  trackToolCall(sessionID: string): number {
    const state = this.getOrCreate(sessionID);
    state.toolCount += 1;
    return state.toolCount;
  }

  trackUsage(sessionID: string, inputTokens: number, outputTokens: number): void {
    const state = this.getOrCreate(sessionID);
    state.inputTokens += inputTokens;
    state.outputTokens += outputTokens;
    state.estimatedTokens = state.inputTokens + state.outputTokens;
  }

  estimateFromText(sessionID: string, text: string): number {
    const estimated = Math.ceil(text.length / 4);
    const state = this.getOrCreate(sessionID);
    state.estimatedTokens += estimated;
    return state.estimatedTokens;
  }

  shouldCompact(sessionID: string, agentName: string): boolean {
    if (!this.isEnabled()) return false;
    const budget = resolveEffectiveBudget(agentName, this.config);
    const state = this.getOrCreate(sessionID);

    const effectiveTokens = Math.max(state.estimatedTokens, state.inputTokens + state.outputTokens);

    if (effectiveTokens < budget.compactThreshold) return false;
    if (effectiveTokens - state.lastCompactAt >= budget.compactRepeat) {
      state.lastCompactAt = effectiveTokens;
      return true;
    }
    if (state.lastCompactAt === 0) {
      state.lastCompactAt = effectiveTokens;
      return true;
    }
    return false;
  }

  markCompacted(sessionID: string): void {
    const state = this.getOrCreate(sessionID);
    state.lastCompactAt = state.estimatedTokens;
  }

  getReport(sessionID: string, agentName?: string): SessionTokenReport {
    const state = this.getOrCreate(sessionID);
    const agent = agentName ?? "polat";
    const budget = resolveEffectiveBudget(agent, this.config);
    const effectiveTokens = Math.max(state.estimatedTokens, state.inputTokens + state.outputTokens);
    const budgetRemaining = Math.max(0, budget.compactThreshold - effectiveTokens);
    const budgetPercentUsed =
      budget.compactThreshold > 0
        ? Math.min(100, Math.round((effectiveTokens / budget.compactThreshold) * 100))
        : 0;

    return {
      sessionID,
      agent,
      estimatedTokens: effectiveTokens,
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      toolCount: state.toolCount,
      budget,
      budgetRemaining,
      budgetPercentUsed,
      shouldCompact: this.shouldCompact(sessionID, agent),
    };
  }

  clearSession(sessionID: string): void {
    this.sessions.delete(sessionID);
  }

  getAllReports(agent?: string): SessionTokenReport[] {
    const reports: SessionTokenReport[] = [];
    for (const sessionID of this.sessions.keys()) {
      reports.push(this.getReport(sessionID, agent));
    }
    return reports;
  }
}

export function truncatePromptAppend(promptAppend: string | undefined, maxChars: number): string {
  if (!promptAppend) return "";
  if (promptAppend.length <= maxChars) return promptAppend;
  const truncated = promptAppend.slice(0, maxChars - 3);
  return `${truncated}...`;
}
