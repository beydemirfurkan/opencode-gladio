import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../memory";
import { createHookRuntime } from "../hooks/runtime";
import { createSystemPromptHook } from "../hooks/system-prompt";

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), "gladio-injection-"));
}

describe("memory injection", () => {
  it("injects memory summary for polat", async () => {
    const projectDir = createTempProject();

    try {
      const memory = new MemoryStore(projectDir, { dir: ".gladio" });
      memory.addLearning("convention", "Run bun test before push", 0.9);

      const runtime = createHookRuntime(
        { directory: projectDir, client: {} } as never,
        {},
        memory,
      );
      runtime.prepareSessionContext("s1");
      runtime.setSessionAgent("s1", "polat");

      const hook = createSystemPromptHook(runtime);
      const output = { system: ["base prompt"] };

      await hook["experimental.chat.system.transform"]({ sessionID: "s1" }, output);

      expect(output.system[0]).toContain("[GladioMemory] 1 learning");
      expect(output.system[0]).toContain("Run bun test before push");
      expect(output.system[0]).toContain("base prompt");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
