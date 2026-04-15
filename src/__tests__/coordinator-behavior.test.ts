import { describe, expect, it } from "bun:test";
import { buildCoordinatorPrompt } from "../prompts/coordinator";

describe("Coordinator behavior policy", () => {
  it("pushes backlog and issue generation without asking permission again", () => {
    const prompt = buildCoordinatorPrompt();

    expect(prompt).toContain(
      "If analysis is done, produce the backlog/issues/acceptance criteria directly instead of asking permission.",
    );
  });

  it("limits follow-up questions to ambiguity, destructive actions, or unresolved choices", () => {
    const prompt = buildCoordinatorPrompt();

    expect(prompt).toContain(
      "Only ask follow-up questions when scope is ambiguous, a destructive action needs approval, or multiple real product choices remain unresolved.",
    );
  });
});
