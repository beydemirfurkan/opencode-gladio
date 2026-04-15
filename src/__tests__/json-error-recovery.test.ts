import { describe, it, expect } from "bun:test";
import { createJsonErrorRecoveryHook } from "../hooks/json-error-recovery";
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
    hooks: { json_error_recovery: enabled },
  } as HarnessConfig;
}

describe("json-error-recovery", () => {
  it("warns recovery success for fixable JSON in markdown", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("j1");
    const hook = createJsonErrorRecoveryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    const brokenOutput = "```json\n{\"key\": \"value\"}\n```";
    await hook["tool.execute.after"]?.(
      { sessionID: "j1", agent: "polat", tool: "mcp_some_tool", args: {} },
      { error: `JSON parse error: unexpected token\n${brokenOutput}` },
    );

    console.warn = origWarn;
    expect(warnings.some((w) => w.includes("[JSONRecovery]"))).toBe(true);
    expect(warnings[0]).toContain("session=j1");
    expect(warnings[0]).toContain("agent=polat");
    expect(warnings[0]).toContain("tool=mcp_some_tool");
    expect(warnings[0]).toContain("source=error");
  });

  it("warns failure for unfixable broken JSON", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("j2");
    const hook = createJsonErrorRecoveryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "j2", tool: "mcp_tool", args: {} },
      { error: "JSON parse error: unexpected token at position 0" },
    );

    console.warn = origWarn;
    expect(warnings.some((w) => w.includes("[JSONRecovery]"))).toBe(true);
    expect(warnings[0]).toContain("tool=mcp_tool");
  });

  it("ignores plain-text MCP output without JSON signals", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("j2b");
    const hook = createJsonErrorRecoveryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "j2b", tool: "mcp_tool", args: {} },
      { output: "search completed successfully" },
    );

    console.warn = origWarn;
    expect(warnings).toHaveLength(0);
  });

  it("does nothing for non-JSON tools with no errors", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    runtime.prepareSessionContext("j3");
    const hook = createJsonErrorRecoveryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "j3", tool: "bash", args: { command: "ls" } },
      "file1.ts\nfile2.ts",
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });

  it("does nothing when disabled", async () => {
    const config = makeConfig(false);
    const runtime = makeRuntime();
    runtime.prepareSessionContext("j4");
    const hook = createJsonErrorRecoveryHook(config, runtime);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    await hook["tool.execute.after"]?.(
      { sessionID: "j4", tool: "mcp_tool", args: {} },
      { error: "JSON parse error" },
    );

    console.warn = origWarn;
    expect(warnings.length).toBe(0);
  });
});
