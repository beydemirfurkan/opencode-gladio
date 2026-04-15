import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../memory";

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), "gladio-memory-"));
}

describe("MemoryStore", () => {
  it("adds, queries and removes learnings", () => {
    const projectDir = createTempProject();

    try {
      const memory = new MemoryStore(projectDir, { dir: ".gladio", max_learnings: 5 });
      memory.addLearning("pattern", "Use bun test for test runs", 0.9);
      memory.addLearning("pitfall", "Avoid editing dist directly", 0.7);

      expect(memory.learningCount()).toBe(2);
      expect(memory.queryLearnings({ query: "bun" })).toHaveLength(1);
      expect(memory.queryLearnings({ category: "pitfall" })).toHaveLength(1);

      const first = memory.queryLearnings({ limit: 1 })[0];
      expect(memory.removeLearning(first.id)).toBe(true);
      expect(memory.learningCount()).toBe(1);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("prunes learnings by confidence", () => {
    const projectDir = createTempProject();

    try {
      const memory = new MemoryStore(projectDir, { dir: ".gladio", max_learnings: 2 });
      memory.addLearning("pattern", "low", 0.2);
      memory.addLearning("pattern", "high", 0.9);
      memory.addLearning("pattern", "mid", 0.5);

      const contents = memory.queryLearnings({ limit: 10 }).map((entry) => entry.content);
      expect(contents).toEqual(["high", "mid"]);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("builds injection line from learnings and pipeline state", () => {
    const projectDir = createTempProject();

    try {
      const memory = new MemoryStore(projectDir, { dir: ".gladio" });
      memory.addLearning("convention", "Prefer bun for scripts", 0.8);
      memory.savePipelineState({
        ended_at: new Date().toISOString(),
        task: "persist memory",
        tier: 2,
        phase: "verify",
        workers_used: ["polat"],
        files_modified: ["src/memory/index.ts"],
        status: "completed",
      });

      const line = memory.buildInjectionLine();
      expect(line).toContain("[GladioMemory] 1 learning");
      expect(line).toContain('Last session: completed "persist memory"');
      expect(line).toContain("Prefer bun for scripts");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("bootstraps context and pipeline files when ensuring the directory", () => {
    const projectDir = createTempProject();

    try {
      const memory = new MemoryStore(projectDir, { dir: ".gladio" });
      memory.ensureDirectory();

      expect(memory.loadContext().project_id).not.toBe("");
      expect(memory.loadPipelineState().last_session).toBeNull();
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("fills missing project facts without overwriting known values", () => {
    const projectDir = createTempProject();

    try {
      const memory = new MemoryStore(projectDir, { dir: ".gladio" });
      memory.saveProjectFacts({
        languages: [],
        frameworks: [],
        package_manager: "unknown",
        test_runner: "vitest",
        build_tool: "unknown",
      });

      memory.ensureProjectFacts({
        languages: ["typescript"],
        frameworks: ["vite"],
        package_manager: "npm",
        test_runner: "unknown",
        build_tool: "tsup",
      });

      const project = memory.loadProjectFacts();
      expect(project.facts.package_manager).toBe("npm");
      expect(project.facts.languages).toEqual(["typescript"]);
      expect(project.facts.frameworks).toEqual(["vite"]);
      expect(project.facts.test_runner).toBe("vitest");
      expect(project.facts.build_tool).toBe("tsup");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
