import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { HarnessConfig } from "../types";
import { createHarnessHooks } from "../hooks";
import { createHookRuntime } from "../hooks/runtime";
import { createSessionStartHook } from "../hooks/session-start";

function stubPluginInput(directory: string): PluginInput {
  return { directory } as PluginInput;
}

function createHarnessConfig(overrides?: Partial<HarnessConfig>): HarnessConfig {
  return {
    ...overrides,
  } as HarnessConfig;
}

describe("Hook runtime helpers", () => {
  it("respects hook toggles and disables all when set to false", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hooks-runtime-test-"));
    try {
      const ctx = stubPluginInput(tmpDir);
      const config: HarnessConfig = createHarnessConfig({
        hooks: {
          session_start: false,
          pre_tool_use: false,
          post_tool_use: false,
          pre_compact: false,
          stop: false,
          session_end: false,
          file_edited: false,
          prompt_refiner: false,
        },
      });

      const hooks = await createHarnessHooks(ctx, config);

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
          pre_tool_use: false,
          post_tool_use: false,
          pre_compact: false,
          stop: false,
          session_end: false,
          file_edited: false,
          prompt_refiner: false,
        },
      });

      const hooks = await createHarnessHooks(ctx, config);

      expect(hooks["session.created"]).toBeDefined();
      expect(typeof hooks["session.created"]).toBe("function");
      expect(hooks["experimental.chat.system.transform"]).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("createSessionStartHook", () => {
  it("injects project facts for subagents", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hooks-runtime-test-"));
    try {
      const ctx = stubPluginInput(tmpDir);
      const config: HarnessConfig = createHarnessConfig({});

      const runtime = createHookRuntime(ctx, config);
      const startHook = createSessionStartHook(ctx, config, runtime);

      const helperSession = "helper-session";
      await startHook["session.created"]?.({ id: helperSession });

      const helperOutput = { message: {} } as { message: Record<string, unknown> };
      await startHook["chat.message"]?.({ sessionID: helperSession, agent: "worker" }, helperOutput);

      expect(typeof helperOutput.message.system).toBe("string");
      expect(helperOutput.message.system).toContain("[ProjectContext]");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
