import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { HarnessConfig } from "../types";
import { createHarnessHooks } from "../hooks";
import { createHookRuntime, PersistedSessionSummary } from "../hooks/runtime";
import { createSessionStartHook } from "../hooks/session-start";

function stubPluginInput(directory: string): PluginInput {
  return { directory } as PluginInput;
}

function createHarnessConfig(overrides?: Partial<HarnessConfig>): HarnessConfig {
  return {
    memory: {
      enabled: true,
    },
    learning: {
      enabled: false,
    },
    ...overrides,
  } as HarnessConfig;
}

describe("Hook runtime helpers", () => {
  it("respects hook toggles and prompt refiner opt-out", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hooks-runtime-test-"));
    try {
      const ctx = stubPluginInput(tmpDir);
      const config: HarnessConfig = createHarnessConfig({
        hooks: {
          comment_guard: false,
          session_start: false,
          pre_tool_use: false,
          post_tool_use: false,
          pre_compact: false,
          stop: false,
          session_end: false,
          file_edited: false,
          prompt_refiner: false,
        },
        memory: {
          enabled: true,
          directory: tmpDir,
        },
      });

      const hooks = await createHarnessHooks(ctx, config);

      expect(hooks.config).toBeUndefined();
      expect(hooks["chat.message"]).toBeUndefined();
      expect(hooks["tool.execute.before"]).toBeUndefined();
      expect(hooks["tool.execute.after"]).toBeUndefined();
      expect(hooks["file.edited"]).toBeUndefined();
      expect(hooks["session.created"]).toBeUndefined();
      expect(hooks["session.idle"]).toBeUndefined();
      expect(hooks["session.deleted"]).toBeUndefined();
      expect(hooks["experimental.chat.messages.transform"]).toBeUndefined();
      expect(hooks["experimental.text.complete"]).toBeUndefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("exposes session lifecycle hooks when session_start remains enabled", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hooks-runtime-test-"));
    try {
      const ctx = stubPluginInput(tmpDir);
      const config: HarnessConfig = createHarnessConfig({
        hooks: {
          // only keep session_start so we can inspect the hook bundle
          comment_guard: false,
          pre_tool_use: false,
          post_tool_use: false,
          pre_compact: false,
          stop: false,
          session_end: false,
          file_edited: false,
          prompt_refiner: false,
        },
        memory: {
          enabled: true,
          directory: tmpDir,
        },
      });

      const hooks = await createHarnessHooks(ctx, config);

      expect(hooks["session.created"]).toBeDefined();
      expect(typeof hooks["session.created"]).toBe("function");
      expect(hooks["session.deleted"]).toBeUndefined();
      expect(hooks["session.idle"]).toBeUndefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("createSessionStartHook", () => {
  it("injects session context only for the primary agent and gives subagents only project facts", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hooks-runtime-test-"));
    try {
      const ctx = stubPluginInput(tmpDir);
      const config: HarnessConfig = createHarnessConfig({
        memory: {
          enabled: true,
          directory: tmpDir,
        },
        learning: {
          enabled: false,
        },
      });

      const runtime = createHookRuntime(ctx, config);
      const startHook = createSessionStartHook(ctx, config, runtime);

      const primarySession = "primary-session";
      await startHook["session.created"]?.({ id: primarySession });

      const primaryOutput = { message: {} } as { message: Record<string, unknown> };
      await startHook["chat.message"]?.({ sessionID: primarySession, agent: "polat" }, primaryOutput);

      expect(typeof primaryOutput.message.system).toBe("string");
      expect(primaryOutput.message.system).toContain("[SessionStart]");

      const helperSession = "helper-session";
      await startHook["session.created"]?.({ id: helperSession });

      const helperOutput = { message: {} } as { message: Record<string, unknown> };
      await startHook["chat.message"]?.({ sessionID: helperSession, agent: "worker" }, helperOutput);

      expect(typeof helperOutput.message.system).toBe("string");
      expect(helperOutput.message.system).toContain("[ProjectContext]");
      expect(helperOutput.message.system).not.toContain("[SessionStart]");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("Hook runtime persistence", () => {
  it("round-trips a saved session summary via loadLatestSummary", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hooks-runtime-test-"));
    try {
      const ctx = stubPluginInput(tmpDir);
      const config: HarnessConfig = createHarnessConfig({
        memory: {
          enabled: true,
          directory: tmpDir,
        },
        learning: {
          enabled: false,
        },
      });

      const runtime = createHookRuntime(ctx, config);
      const summary: PersistedSessionSummary = {
        sessionID: "summary-session",
        savedAt: new Date().toISOString(),
        locale: "en",
        packageManager: "unknown",
        languages: [],
        frameworks: [],
        changedFiles: [],
        incompleteTodos: [],
        lastUserMessage: "hello",
        lastAssistantMessage: "hi",
        approxTokens: 42,
      };

      runtime.saveSessionSummary(summary);
      const loaded = runtime.loadLatestSummary();
      expect(loaded).toEqual(summary);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
