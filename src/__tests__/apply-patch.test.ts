import { describe, it, expect } from "bun:test";
import { createApplyPatchHook } from "../hooks/apply-patch";
import { createHookRuntime } from "../hooks/runtime";
import type { HarnessConfig } from "../types";

function makeRuntime() {
  return createHookRuntime(
    { directory: "C:\\Users\\test\\project" } as any,
    {} as HarnessConfig,
  );
}

function makeConfig(enabled: boolean = true): HarnessConfig {
  return {
    hooks: { apply_patch_rescue: enabled },
  } as HarnessConfig;
}

describe("apply-patch rescue", () => {
  it("warns on stale patch error for apply-patch tool", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("a1");
    const hook = createApplyPatchHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "a1", tool: "apply-patch", args: { filePath: "src/foo.ts" } },
      { error: "hunk failed: stale context" },
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("[PatchRescue]");
  });

  it("warns on conflict error for edit tool", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("a2");
    const hook = createApplyPatchHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "a2", tool: "edit", args: { filePath: "bar.ts" } },
      "patch failed: conflict detected",
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("[PatchRescue]");
  });

  it("does not warn on successful patch", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("a3");
    const hook = createApplyPatchHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "a3", tool: "apply-patch", args: { filePath: "ok.ts" } },
      { ok: true },
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });

  it("ignores non-patch tools", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("a4");
    const hook = createApplyPatchHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "a4", tool: "bash", args: { command: "echo hi" } },
      "stale error",
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });

  it("does not warn when disabled", async () => {
    const config = makeConfig(false);
    const runtime = makeRuntime();
    runtime.prepareSessionContext("a5");
    const hook = createApplyPatchHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "a5", tool: "apply-patch", args: {} },
      "stale conflict",
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });
});
