import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../memory";
import { createHookRuntime } from "../hooks/runtime";
import { createSessionStartHook } from "../hooks/session-start";
import { createStopHook } from "../hooks/stop";
import type { HarnessConfig } from "../types";

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "gladio-persist-"));
  writeFileSync(join(projectDir, "package.json"), JSON.stringify({ name: "demo" }, null, 2), "utf8");
  writeFileSync(join(projectDir, "package-lock.json"), "{}", "utf8");
  writeFileSync(join(projectDir, "README.md"), "# Demo\n", "utf8");
  return projectDir;
}

function makeConfig(): HarnessConfig {
  return {
    memory: { enabled: true, dir: ".gladio", inject_summary: false },
  } as HarnessConfig;
}

describe("persistence hooks", () => {
  it("bootstraps project facts from chat.message even without session.created", async () => {
    const projectDir = createTempProject();

    try {
      const config = makeConfig();
      const memory = new MemoryStore(projectDir, { enabled: true, dir: ".gladio" });
      const runtime = createHookRuntime({ directory: projectDir } as any, config, memory);
      const hook = createSessionStartHook({ directory: projectDir } as any, config, runtime);

      const output = { message: {} as Record<string, unknown> };
      await hook["chat.message"]?.({ sessionID: "s1", agent: "polat" }, output);

      const project = memory.loadProjectFacts();
      expect(project.facts.package_manager).toBe("npm");
      expect(memory.loadContext().project_id).not.toBe("");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("persists pipeline state for no-tool sessions with meaningful phase", async () => {
    const projectDir = createTempProject();

    try {
      const config = makeConfig();
      const memory = new MemoryStore(projectDir, { enabled: true, dir: ".gladio" });
      const runtime = createHookRuntime({ directory: projectDir } as any, config, memory);
      const hook = createStopHook({ directory: projectDir } as any, config, runtime);

      runtime.prepareSessionContext("s2");
      runtime.setSessionAgent("s2", "polat");
      runtime.updatePhase("s2", "Task done. All changes complete.");

      await hook["session.idle"]?.({ sessionID: "s2" });

      const pipeline = memory.loadPipelineState();
      expect(pipeline.last_session?.status).toBe("completed");
      expect(pipeline.last_session?.phase).toBe("complete");
      expect(pipeline.last_session?.workers_used).toEqual(["polat"]);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
