import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import type { MemoryConfig, HarnessConfig } from "../types";

export type LearningCategory =
  | "convention"
  | "pattern"
  | "pitfall"
  | "architecture"
  | "dependency";

export type Learning = {
  id: string;
  category: LearningCategory;
  content: string;
  source: "agent" | "detected";
  created_at: string;
  confidence: number;
};

export type ContextFile = {
  schema_version: number;
  project_id: string;
  last_updated: string;
  learnings: Learning[];
};

export type PipelineStateFile = {
  schema_version: number;
  last_session: {
    ended_at: string;
    task: string;
    tier: number;
    phase: string;
    workers_used: string[];
    files_modified: string[];
    status: "completed" | "interrupted";
  } | null;
};

export type ProjectFactsFile = {
  schema_version: number;
  facts: {
    languages: string[];
    frameworks: string[];
    package_manager: string;
    test_runner: string;
    build_tool: string;
  };
  key_directories: Record<string, string>;
};

function generateId(): string {
  return `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function projectFingerprint(directory: string): string {
  return createHash("sha1").update(directory).digest("hex").slice(0, 12);
}

function resolveMemoryDir(projectDir: string, config: MemoryConfig): string {
  return join(projectDir, config.dir ?? ".gladio");
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const EMPTY_CONTEXT: ContextFile = {
  schema_version: 1,
  project_id: "",
  last_updated: "",
  learnings: [],
};

const EMPTY_PIPELINE: PipelineStateFile = {
  schema_version: 1,
  last_session: null,
};

const EMPTY_PROJECT: ProjectFactsFile = {
  schema_version: 1,
  facts: {
    languages: [],
    frameworks: [],
    package_manager: "unknown",
    test_runner: "unknown",
    build_tool: "unknown",
  },
  key_directories: {},
};

function createEmptyContext(projectId: string): ContextFile {
  return {
    ...EMPTY_CONTEXT,
    project_id: projectId,
    learnings: [],
  };
}

function createEmptyPipeline(): PipelineStateFile {
  return {
    ...EMPTY_PIPELINE,
    last_session: null,
  };
}

function createEmptyProject(): ProjectFactsFile {
  return {
    ...EMPTY_PROJECT,
    facts: {
      ...EMPTY_PROJECT.facts,
      languages: [],
      frameworks: [],
    },
    key_directories: {},
  };
}

export class MemoryStore {
  private dir: string;
  private projectId: string;
  private maxLearnings: number;
  private enabled: boolean;

  constructor(projectDir: string, config: MemoryConfig) {
    this.dir = resolveMemoryDir(projectDir, config);
    this.projectId = projectFingerprint(projectDir);
    this.maxLearnings = config.max_learnings ?? 100;
    this.enabled = config.enabled !== false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  loadContext(): ContextFile {
    const filePath = join(this.dir, "context.json");
    const data = readJsonFile<ContextFile>(filePath, createEmptyContext(this.projectId));
    return data;
  }

  saveContext(context: ContextFile): void {
    context.last_updated = new Date().toISOString();
    context.project_id = this.projectId;
    writeJsonFile(join(this.dir, "context.json"), context);
  }

  addLearning(
    category: LearningCategory,
    content: string,
    confidence: number = 0.8,
    source: "agent" | "detected" = "agent",
  ): Learning {
    const context = this.loadContext();
    const learning: Learning = {
      id: generateId(),
      category,
      content,
      source,
      created_at: new Date().toISOString(),
      confidence,
    };
    context.learnings.push(learning);
    this.pruneLearnings(context);
    this.saveContext(context);
    return learning;
  }

  queryLearnings(filter?: {
    query?: string;
    category?: LearningCategory;
    limit?: number;
  }): Learning[] {
    const context = this.loadContext();
    let results = [...context.learnings];

    if (filter?.category) {
      results = results.filter((l) => l.category === filter.category);
    }

    if (filter?.query) {
      const q = filter.query.toLowerCase();
      results = results.filter((l) => l.content.toLowerCase().includes(q));
    }

    results.sort((a, b) => b.confidence - a.confidence);

    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  removeLearning(id: string): boolean {
    const context = this.loadContext();
    const index = context.learnings.findIndex((l) => l.id === id);
    if (index === -1) return false;
    context.learnings.splice(index, 1);
    this.saveContext(context);
    return true;
  }

  clearLearnings(): number {
    const context = this.loadContext();
    const count = context.learnings.length;
    context.learnings = [];
    this.saveContext(context);
    return count;
  }

  learningCount(): number {
    return this.loadContext().learnings.length;
  }

  private pruneLearnings(context: ContextFile): void {
    if (context.learnings.length <= this.maxLearnings) return;
    context.learnings.sort((a, b) => b.confidence - a.confidence);
    context.learnings = context.learnings.slice(0, this.maxLearnings);
  }

  savePipelineState(state: PipelineStateFile["last_session"]): void {
    const file: PipelineStateFile = {
      schema_version: 1,
      last_session: state,
    };
    writeJsonFile(join(this.dir, "pipeline-state.json"), file);
  }

  loadPipelineState(): PipelineStateFile {
    return readJsonFile<PipelineStateFile>(
      join(this.dir, "pipeline-state.json"),
      createEmptyPipeline(),
    );
  }

  saveProjectFacts(facts: ProjectFactsFile["facts"], keyDirectories?: Record<string, string>): void {
    const file: ProjectFactsFile = {
      schema_version: 1,
      facts,
      key_directories: keyDirectories ?? {},
    };
    writeJsonFile(join(this.dir, "project.json"), file);
  }

  loadProjectFacts(): ProjectFactsFile {
    return readJsonFile<ProjectFactsFile>(
      join(this.dir, "project.json"),
      createEmptyProject(),
    );
  }

  buildInjectionLine(): string {
    const contextExists = existsSync(join(this.dir, "context.json"));
    const pipelineExists = existsSync(join(this.dir, "pipeline-state.json"));

    if (!contextExists && !pipelineExists) return "";

    const context = this.loadContext();
    const pipeline = this.loadPipelineState();
    const count = context.learnings.length;

    if (count === 0 && !pipeline.last_session) return "";

    const parts: string[] = [];
    parts.push(`[GladioMemory] ${count} learning${count !== 1 ? "s" : ""}`);

    if (pipeline.last_session) {
      const s = pipeline.last_session;
      const statusLabel = s.status === "completed" ? "completed" : "interrupted";
      parts.push(`Last session: ${statusLabel} "${s.task}" (T${s.tier}, ${s.phase})`);
    }

    const topLearnings = [...context.learnings]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    if (topLearnings.length > 0) {
      const labels = topLearnings.map((l) => l.content).join("; ");
      parts.push(`Key: ${labels}`);
    }

    parts.push("Use gladio-recall to query. Use gladio-learn to persist findings.");
    return parts.join(" | ");
  }

  ensureDirectory(): void {
    ensureDir(this.dir);
  }

  getDirectory(): string {
    return this.dir;
  }
}

export function resolveMemoryConfig(config: HarnessConfig): MemoryConfig {
  return config.memory ?? { enabled: true, dir: ".gladio", max_learnings: 100, inject_summary: true };
}

export function isMemoryEnabled(config: HarnessConfig): boolean {
  return config.memory?.enabled !== false;
}
