import { describe, expect, it } from "bun:test";
import { resolveFallbackState, DEFAULT_PRIMARY_CANDIDATES } from "../fallbacks";
import type { HarnessConfig } from "../types";

describe("Fallback helpers", () => {
  it("keeps supported primary candidates", () => {
    const config: HarnessConfig = {
      agents: {
        polat: {
          model: "openai/gpt-5.4",
          variant: "xhigh",
        },
        halit: {
          model: "openai/gpt-5.4-mini",
          variant: "none",
        },
      },
    };

    const state = resolveFallbackState(config);

    expect(state.coordinator.selectedSource).toBe("primary");
    expect(state.coordinator.selectedCandidate.model).toBe("openai/gpt-5.4");
    expect(state.coordinator.degraded).toBe(false);
    expect(state.verifier.selectedCandidate).toEqual(DEFAULT_PRIMARY_CANDIDATES.verifier);
    expect(state.verifier.degraded).toBe(false);
  });

  it("uses fallback when primary candidate unsupported", () => {
    const config: HarnessConfig = {
      agents: {
        polat: {
          model: "unsupported/model",
          variant: "none",
        },
      },
    };

    const state = resolveFallbackState(config);

    expect(state.coordinator.selectedSource).toBe("fallback[0]");
    expect(state.coordinator.selectedCandidate.model).toBe("openai/gpt-5.4");
    expect(state.coordinator.selectedCandidate.variant).toBe("high");
    expect(state.coordinator.degraded).toBe(true);
    expect(state.coordinator.selectedReason).toContain("unsupported");
  });
});
