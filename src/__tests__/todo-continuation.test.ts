import { describe, it, expect } from "bun:test";
import { createTodoContinuationHook } from "../hooks/todo-continuation";
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
    hooks: { todo_continuation: enabled },
  } as HarnessConfig;
}

describe("todo-continuation", () => {
  it("warns when session idles with unfinished work", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();

    runtime.prepareSessionContext("t1");
    runtime.setSessionAgent("t1", "memati");
    runtime.incrementToolCount("t1");
    runtime.incrementToolCount("t1");
    runtime.updatePhase("t1", "implementing feature X");

    const hook = createTodoContinuationHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["session.idle"]?.({ sessionID: "t1" });

    console.warn = origWarn;
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("[UnfinishedWork]");
  });

  it("does not warn for complete sessions", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();

    runtime.prepareSessionContext("t2");
    runtime.incrementToolCount("t2");
    runtime.updatePhase("t2", "Task done. All changes complete.");

    const hook = createTodoContinuationHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["session.idle"]?.({ sessionID: "t2" });

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });

  it("does not warn for sessions with zero tools", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();

    runtime.prepareSessionContext("t3");

    const hook = createTodoContinuationHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["session.idle"]?.({ sessionID: "t3" });

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });

  it("does not warn when disabled", async () => {
    const config = makeConfig(false);
    const runtime = makeRuntime();

    runtime.prepareSessionContext("t4");
    runtime.incrementToolCount("t4");

    const hook = createTodoContinuationHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["session.idle"]?.({ sessionID: "t4" });

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });
});
