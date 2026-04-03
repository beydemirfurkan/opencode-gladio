import { describe, expect, it } from "bun:test";
import { createHarnessAgents } from "../agents";
import { CURRENT_HARNESS_SCHEMA_VERSION } from "../config";
import { buildCoordinatorPrompt } from "../prompts/coordinator";
import type { HarnessConfig } from "../types";

const baseConfig: HarnessConfig = {
  schema_version: CURRENT_HARNESS_SCHEMA_VERSION,
  default_mode: "coordinator",
  set_default_agent: true,
};

describe("worker visibility mode", () => {
  it("keeps workers hidden by default summary mode", () => {
    const agents = createHarnessAgents(baseConfig);

    expect((agents.memati as { hidden?: boolean }).hidden).toBe(true);
    expect((agents.halit as { hidden?: boolean }).hidden).toBe(true);
  });

  it("makes workers visible when ui.worker_visibility is visible", () => {
    const agents = createHarnessAgents({
      ...baseConfig,
      ui: { worker_visibility: "visible" },
    });

    expect((agents.memati as { hidden?: boolean }).hidden).toBe(false);
    expect((agents.halit as { hidden?: boolean }).hidden).toBe(false);
  });
});

describe("buildCoordinatorPrompt visibility guidance", () => {
  it("includes summary visibility guidance by default", () => {
    const prompt = buildCoordinatorPrompt();

    expect(prompt).toContain("Keep orchestration visible to the user through short coordinator updates.");
    expect(prompt).toContain("Status: Çakır splitting execution plan.");
  });

  it("includes visible-mode guidance when workers may appear in the UI", () => {
    const prompt = buildCoordinatorPrompt(undefined, "visible");

    expect(prompt).toContain("Workers may appear in the UI.");
  });

  it("omits visibility guidance when mode is off", () => {
    const prompt = buildCoordinatorPrompt(undefined, "off");

    expect(prompt).not.toContain("Keep orchestration visible to the user");
    expect(prompt).not.toContain("Workers may appear in the UI.");
  });
});
