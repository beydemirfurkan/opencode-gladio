import { describe, it, expect } from "bun:test";
import { createPostToolUseHook } from "../hooks/post-tool-use";
import { createHookRuntime } from "../hooks/runtime";
import type { HarnessConfig, HookProfile } from "../types";

function makeRuntime() {
  return createHookRuntime(
    { directory: "C:\\Users\\test\\project" } as any,
    {} as HarnessConfig,
  );
}

function makeConfig(overrides?: Partial<HarnessConfig["hooks"]>): HarnessConfig {
  return {
    hooks: {
      profile: "standard",
      post_tool_use_nudge: true,
      checkpoint_interval: 5,
      ...overrides,
    },
  } as HarnessConfig;
}

describe("post-tool-use", () => {
  describe("post-edit nudge", () => {
    it("warns when .ts file is edited via edit tool", async () => {
      const config = makeConfig();
      const runtime = makeRuntime();
      const hook = createPostToolUseHook(config, runtime, "standard");

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      runtime.prepareSessionContext("s1");
      runtime.incrementToolCount("s1");

      await hook["tool.execute.after"]?.(
        { sessionID: "s1", tool: "edit", args: { filePath: "src/foo.ts" } },
        {},
      );

      console.warn = origWarn;
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("[PostEdit]");
      expect(warnings[0]).toContain("tsc");
    });

    it("warns for .tsx files", async () => {
      const config = makeConfig();
      const runtime = makeRuntime();
      const hook = createPostToolUseHook(config, runtime, "standard");

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      runtime.prepareSessionContext("s2");
      runtime.incrementToolCount("s2");

      await hook["tool.execute.after"]?.(
        { sessionID: "s2", tool: "edit", args: { filePath: "src/App.tsx" } },
        {},
      );

      console.warn = origWarn;
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain(".tsx");
    });

    it("warns for .go files", async () => {
      const config = makeConfig();
      const runtime = makeRuntime();
      const hook = createPostToolUseHook(config, runtime, "standard");

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      runtime.prepareSessionContext("s3");
      runtime.incrementToolCount("s3");

      await hook["tool.execute.after"]?.(
        { sessionID: "s3", tool: "write", args: { filePath: "main.go" } },
        {},
      );

      console.warn = origWarn;
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("go build");
    });

    it("does not nudge for minimal profile", async () => {
      const config = makeConfig({ profile: "minimal" });
      const runtime = makeRuntime();
      const hook = createPostToolUseHook(config, runtime, "minimal");

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      runtime.prepareSessionContext("s4");
      runtime.incrementToolCount("s4");

      await hook["tool.execute.after"]?.(
        { sessionID: "s4", tool: "edit", args: { filePath: "src/foo.ts" } },
        {},
      );

      console.warn = origWarn;
      expect(warnings.length).toBe(0);
    });

    it("does not nudge when nudge is disabled", async () => {
      const config = makeConfig({ post_tool_use_nudge: false });
      const runtime = makeRuntime();
      const hook = createPostToolUseHook(config, runtime, "standard");

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      runtime.prepareSessionContext("s5");
      runtime.incrementToolCount("s5");

      await hook["tool.execute.after"]?.(
        { sessionID: "s5", tool: "edit", args: { filePath: "src/foo.ts" } },
        {},
      );

      console.warn = origWarn;
      expect(warnings.length).toBe(0);
    });

    it("deduplicates identical consecutive nudges", async () => {
      const config = makeConfig();
      const runtime = makeRuntime();
      const hook = createPostToolUseHook(config, runtime, "standard");

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      runtime.prepareSessionContext("s6");
      runtime.incrementToolCount("s6");

      await hook["tool.execute.after"]?.(
        { sessionID: "s6", tool: "edit", args: { filePath: "src/a.ts" } },
        {},
      );
      runtime.incrementToolCount("s6");
      await hook["tool.execute.after"]?.(
        { sessionID: "s6", tool: "edit", args: { filePath: "src/b.ts" } },
        {},
      );

      console.warn = origWarn;
      expect(warnings.length).toBe(1);
    });
  });

  describe("checkpoint reminder", () => {
    it("emits checkpoint at configured interval", async () => {
      const config = makeConfig({ checkpoint_interval: 3, post_tool_use_nudge: false });
      const runtime = makeRuntime();
      const hook = createPostToolUseHook(config, runtime, "standard");

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      runtime.prepareSessionContext("c1");
      runtime.incrementToolCount("c1");
      runtime.incrementToolCount("c1");
      runtime.incrementToolCount("c1");

      await hook["tool.execute.after"]?.(
        { sessionID: "c1", tool: "bash", args: { command: "echo hi" } },
        {},
      );

      console.warn = origWarn;
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("[Pipeline]");
      expect(warnings[0]).toContain("Tool #3");
    });
  });
});
