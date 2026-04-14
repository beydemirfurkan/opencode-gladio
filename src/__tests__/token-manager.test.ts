import { describe, expect, it } from "bun:test";
import {
  TokenManager,
  getAgentBudget,
  resolveEffectiveBudget,
  truncatePromptAppend,
  getPruningRules,
} from "../token-manager";

describe("getAgentBudget", () => {
  it("returns coordinator budget for polat", () => {
    const budget = getAgentBudget("polat");
    expect(budget.promptChars).toBe(8000);
    expect(budget.compactThreshold).toBe(80_000);
    expect(budget.compactRepeat).toBe(30_000);
  });

  it("returns fallback budget for unknown agent", () => {
    const budget = getAgentBudget("unknown-agent");
    expect(budget.promptChars).toBe(4000);
    expect(budget.compactThreshold).toBe(50_000);
  });

  it("returns different budgets for different agents", () => {
    const polat = getAgentBudget("polat");
    const halit = getAgentBudget("halit");
    expect(polat.compactThreshold).toBeGreaterThan(halit.compactThreshold);
    expect(polat.promptChars).toBeGreaterThan(halit.promptChars);
  });
});

describe("resolveEffectiveBudget", () => {
  it("applies agent overrides", () => {
    const budget = resolveEffectiveBudget("polat", {
      agentOverrides: {
        polat: { compactThreshold: 100_000 },
      },
    });
    expect(budget.compactThreshold).toBe(100_000);
    expect(budget.compactRepeat).toBe(30_000);
  });

  it("applies global threshold override", () => {
    const budget = resolveEffectiveBudget("memati", {
      globalCompactThreshold: 120_000,
    });
    expect(budget.compactThreshold).toBe(120_000);
  });

  it("global override takes precedence over agent default", () => {
    const budget = resolveEffectiveBudget("polat", {
      globalCompactThreshold: 40_000,
    });
    expect(budget.compactThreshold).toBe(40_000);
  });
});

describe("TokenManager", () => {
  it("tracks tool calls and returns incrementing count", () => {
    const tm = new TokenManager({ enabled: true });
    expect(tm.trackToolCall("s1")).toBe(1);
    expect(tm.trackToolCall("s1")).toBe(2);
    expect(tm.trackToolCall("s1")).toBe(3);
  });

  it("tracks usage tokens", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 1000, 500);
    const report = tm.getReport("s1", "polat");
    expect(report.inputTokens).toBe(1000);
    expect(report.outputTokens).toBe(500);
    expect(report.estimatedTokens).toBe(1500);
  });

  it("suggests compact when threshold exceeded", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 50_000, 40_000);
    expect(tm.shouldCompact("s1", "polat")).toBe(true);
  });

  it("does not suggest compact below threshold", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 1000, 500);
    expect(tm.shouldCompact("s1", "polat")).toBe(false);
  });

  it("respects repeat interval after first compact", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 50_000, 40_000);
    expect(tm.shouldCompact("s1", "polat")).toBe(true);
    tm.trackUsage("s1", 5_000, 5_000);
    expect(tm.shouldCompact("s1", "polat")).toBe(false);
  });

  it("disables compact when enabled=false", () => {
    const tm = new TokenManager({ enabled: false });
    tm.trackUsage("s1", 50_000, 40_000);
    expect(tm.shouldCompact("s1", "polat")).toBe(false);
    expect(tm.isEnabled()).toBe(false);
  });

  it("clears session state", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 1000, 500);
    tm.clearSession("s1");
    const report = tm.getReport("s1", "polat");
    expect(report.estimatedTokens).toBe(0);
  });

  it("generates correct budget report", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 40_000, 20_000);
    tm.trackToolCall("s1");
    tm.trackToolCall("s1");
    const report = tm.getReport("s1", "polat");
    expect(report.sessionID).toBe("s1");
    expect(report.agent).toBe("polat");
    expect(report.estimatedTokens).toBe(60_000);
    expect(report.toolCount).toBe(2);
    expect(report.budgetPercentUsed).toBe(75);
    expect(report.budgetRemaining).toBe(20_000);
  });

  it("getAllReports returns all sessions", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 1000, 0);
    tm.trackUsage("s2", 2000, 0);
    expect(tm.getAllReports()).toHaveLength(2);
  });

  it("markCompacted resets compact tracking", () => {
    const tm = new TokenManager({ enabled: true });
    tm.trackUsage("s1", 50_000, 40_000);
    expect(tm.shouldCompact("s1", "polat")).toBe(true);
    tm.markCompacted("s1");
    tm.trackUsage("s1", 1_000, 1_000);
    expect(tm.shouldCompact("s1", "polat")).toBe(false);
  });
});

describe("truncatePromptAppend", () => {
  it("returns empty for undefined", () => {
    expect(truncatePromptAppend(undefined, 100)).toBe("");
  });

  it("returns original when under limit", () => {
    expect(truncatePromptAppend("hello", 100)).toBe("hello");
  });

  it("truncates when over limit", () => {
    const long = "a".repeat(200);
    const result = truncatePromptAppend(long, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("...")).toBe(true);
  });
});

describe("getPruningRules", () => {
  it("returns rules sorted by priority", () => {
    const rules = getPruningRules();
    expect(rules.length).toBe(3);
    for (let i = 1; i < rules.length; i++) {
      expect(rules[i].priority).toBeGreaterThanOrEqual(rules[i - 1].priority);
    }
  });
});
