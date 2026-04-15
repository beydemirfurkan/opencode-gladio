import { describe, it, expect } from "bun:test";
import { createDelegateTaskRetryHook } from "../hooks/delegate-task-retry";
import { createHookRuntime } from "../hooks/runtime";
import type { HarnessConfig } from "../types";

function makeRuntime() {
  return createHookRuntime(
    { directory: "C:\\Users\\test\\project" } as any,
    {} as HarnessConfig,
  );
}

function makeConfig(overrides?: Partial<HarnessConfig["hooks"]>): HarnessConfig {
  return {
    hooks: { delegate_retry: true, delegate_max_retries: 2, ...overrides },
  } as HarnessConfig;
}

describe("delegate-task-retry", () => {
  it("warns on first retry attempt", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("d1");
    const hook = createDelegateTaskRetryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "d1", tool: "delegate-task", args: { task: "implement auth" } },
      { error: "timeout" },
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("[DelegateRetry]");
    expect(warnings[0]).toContain("attempt 1/2");
  });

  it("escalates after max retries", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("d2");
    const hook = createDelegateTaskRetryHook(config, runtime);

    const origWarn = console.warn;
    console.warn = () => {};

    await hook["tool.execute.after"]?.(
      { sessionID: "d2", tool: "delegate-task", args: { task: "implement auth" } },
      { error: "timeout" },
    );
    await hook["tool.execute.after"]?.(
      { sessionID: "d2", tool: "delegate-task", args: { task: "implement auth" } },
      { error: "timeout" },
    );

    console.warn = origWarn;

    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "d2", tool: "delegate-task", args: { task: "implement auth" } },
      { error: "timeout" },
    );

    console.warn = origWarn;
    expect(warnings.some((w) => w.includes("[DelegateEscalate]"))).toBe(true);
  });

  it("ignores successful delegations", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("d3");
    const hook = createDelegateTaskRetryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "d3", tool: "delegate-task", args: { task: "do thing" } },
      { ok: true },
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });

  it("does nothing when disabled", async () => {
    const config = makeConfig({ delegate_retry: false });
    const runtime = makeRuntime();
    runtime.prepareSessionContext("d4");
    const hook = createDelegateTaskRetryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "d4", tool: "delegate-task", args: {} },
      { error: "failed" },
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });
});
