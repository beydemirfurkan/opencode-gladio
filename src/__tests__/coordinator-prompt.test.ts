import { describe, expect, it } from "bun:test";
import { buildCoordinatorPrompt } from "../prompts/coordinator";

describe("Coordinator prompt", () => {
  it("keeps diagnosis and direct-answer lanes in the tier pipeline", () => {
    const prompt = buildCoordinatorPrompt();

    expect(prompt).toContain("Answer directly when no worker, file edit, or tool use is needed.");
    expect(prompt).toContain("Do not escalate from auth/DB/API keywords alone.");
    expect(prompt).toContain("Do not ask for the obvious next artifact.");
    expect(prompt).toContain("Only ask follow-up questions when scope is ambiguous");
    expect(prompt).toContain("T1 (direct/trivial): explanation, read-only diagnosis");
    expect(prompt).toContain("T3 (risky): security-sensitive or contract-changing auth/DB/API work");
  });

  it("instructs the coordinator to avoid permission-bounce phrasing", () => {
    const prompt = buildCoordinatorPrompt();

    expect(prompt).toContain(
      "When the next deliverable is obvious from the current task state, produce it directly instead of asking the user whether you should continue.",
    );
  });
});
