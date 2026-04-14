import { describe, expect, it } from "bun:test";
import { ForegroundFallbackManager } from "../fallback-manager";

describe("ForegroundFallbackManager", () => {
  it("is disabled when no chains provided", () => {
    const fm = new ForegroundFallbackManager({}, {}, false);
    expect(fm.isEnabled()).toBe(false);
  });

  it("is enabled when chains provided and enabled=true", () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a", "model-b"] },
      true,
    );
    expect(fm.isEnabled()).toBe(true);
  });

  it("returns undefined for unknown agent", () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a"] },
      true,
    );
    expect(fm.getCurrentModel("unknown")).toBeUndefined();
  });

  it("returns first model initially", () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a", "model-b"] },
      true,
    );
    expect(fm.getCurrentModel("polat")).toBe("model-a");
  });

  it("switches to fallback on rate limit", async () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a", "model-b"] },
      true,
    );

    await fm.handleEvent({
      type: "session.status",
      properties: {
        sessionID: "s1",
        agent: "polat",
        status: { type: "error", code: "429", message: "rate limit exceeded" },
      },
    });

    expect(fm.getCurrentModel("polat")).toBe("model-b");
  });

  it("does not switch on non-rate-limit errors", async () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a", "model-b"] },
      true,
    );

    await fm.handleEvent({
      type: "session.status",
      properties: {
        sessionID: "s1",
        agent: "polat",
        status: { type: "error", code: "500", message: "internal error" },
      },
    });

    expect(fm.getCurrentModel("polat")).toBe("model-a");
  });

  it("ignores non-status events", async () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a", "model-b"] },
      true,
    );

    await fm.handleEvent({
      type: "chat.message",
      properties: {
        sessionID: "s1",
        agent: "polat",
      },
    });

    expect(fm.getCurrentModel("polat")).toBe("model-a");
  });

  it("wraps around to first model after all fallbacks exhausted", async () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a", "model-b"] },
      true,
    );

    await fm.handleEvent({
      type: "session.status",
      properties: {
        sessionID: "s1",
        agent: "polat",
        status: { type: "error", message: "rate_limit exceeded" },
      },
    });

    expect(fm.getCurrentModel("polat")).toBe("model-b");

    await fm.handleEvent({
      type: "session.status",
      properties: {
        sessionID: "s2",
        agent: "polat",
        status: { type: "error", message: "rate_limit exceeded" },
      },
    });

    expect(fm.getCurrentModel("polat")).toBe("model-a");
  });

  it("does nothing when disabled", async () => {
    const fm = new ForegroundFallbackManager(
      {},
      { polat: ["model-a"] },
      false,
    );

    await fm.handleEvent({
      type: "session.status",
      properties: {
        sessionID: "s1",
        agent: "polat",
        status: { type: "error", message: "rate_limit exceeded" },
      },
    });

    expect(fm.isEnabled()).toBe(false);
  });
});
