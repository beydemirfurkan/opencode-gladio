import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../memory";
import { createMemoryTools } from "../tools";

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), "gladio-tools-"));
}

describe("createMemoryTools", () => {
  it("saves and recalls learnings through tool executors", async () => {
    const projectDir = createTempProject();

    try {
      const memory = new MemoryStore(projectDir, { dir: ".gladio" });
      const tools = createMemoryTools(memory);

      const saveResult = await tools["gladio-learn"].execute({
        category: "architecture",
        content: "Plugin composes hooks centrally",
        confidence: 0.95,
      });

      expect(String(saveResult)).toContain("Saved learning");

      const recallResult = await tools["gladio-recall"].execute({
        query: "hooks",
        limit: 5,
      });

      expect(String(recallResult)).toContain("Plugin composes hooks centrally");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
