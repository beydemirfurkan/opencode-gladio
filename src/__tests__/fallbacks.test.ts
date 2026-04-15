import { describe, expect, it } from "bun:test";
import { resolveFallbackState, DEFAULT_PRIMARY_CANDIDATES } from "../fallbacks";
import type { HarnessConfig } from "../types";

describe("Fallback helpers", () => {
  it("uses configured primary candidate as selected", () => {
    const config: HarnessConfig = {
      agents: {
        polat: {
          model: "zai/glm-5.1",
          variant: "high",
        },
        halit: {
          variant: "none",
        },
      },
    };

    const state = resolveFallbackState(config);

    expect(state.coordinator.selectedSource).toBe("primary");
    expect(state.coordinator.selectedCandidate.model).toBe("zai/glm-5.1");
    expect(state.coordinator.degraded).toBe(false);
    expect(state.verifier.selectedCandidate).toEqual(DEFAULT_PRIMARY_CANDIDATES.verifier);
    expect(state.verifier.degraded).toBe(false);
  });

  it("uses defaults when no agent overrides configured", () => {
    const config: HarnessConfig = {};

    const state = resolveFallbackState(config);

    expect(state.coordinator.selectedSource).toBe("primary");
    expect(state.coordinator.selectedCandidate.model).toBeUndefined();
    expect(state.coordinator.selectedCandidate.variant).toBe("high");
    expect(state.coordinator.degraded).toBe(false);
  });

  it("uses configured fallback chains when provided", () => {
    const config: HarnessConfig = {
      fallbacks: {
        coordinator: [
          { model: "anthropic/claude-sonnet-4-20250514", variant: "high" },
        ],
        verifier: [],
      },
    };

    const state = resolveFallbackState(config);

    expect(state.coordinator.configuredFallbacks).toHaveLength(1);
    expect(state.coordinator.configuredFallbacks[0].model).toBe("anthropic/claude-sonnet-4-20250514");
  });

  it("maps fallback chains by agent name", () => {
    const config: HarnessConfig = {
      fallbacks: {
        chains: {
          polat: ["zai/glm-5.1", "openai/gpt-5.4"],
          halit: ["opencode-go/kimi-k2.5"],
        },
      },
    };

    const state = resolveFallbackState(config);

    expect(state.coordinator.configuredFallbacks).toEqual([
      { model: "zai/glm-5.1" },
      { model: "openai/gpt-5.4" },
    ]);
    expect(state.verifier.configuredFallbacks).toEqual([
      { model: "opencode-go/kimi-k2.5" },
    ]);
  });
});
