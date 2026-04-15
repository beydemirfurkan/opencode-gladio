import { describe, it, expect } from "bun:test";
import { createPhaseReminderHook } from "../hooks/phase-reminder";
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
    hooks: { phase_reminder: true, stuck_threshold: 3, ...overrides },
  } as HarnessConfig;
}

describe("phase-reminder", () => {
  it("adds phase prefix to assistant messages", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    const hook = createPhaseReminderHook(config, runtime);

    runtime.prepareSessionContext("p1");

    const messages = [{ role: "assistant", content: "I will implement this feature." }];
    await hook["experimental.chat.messages.transform"]?.(
      { sessionID: "p1" },
      { messages },
    );

    expect(messages[0].content).toContain("[Phase:");
  });

  it("detects tier phase from tier classification", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    const hook = createPhaseReminderHook(config, runtime);

    runtime.prepareSessionContext("p2");

    const messages = [{ role: "assistant", content: "This is Tier 2 because it's a standard refactor." }];
    await hook["experimental.chat.messages.transform"]?.(
      { sessionID: "p2" },
      { messages },
    );

    expect(messages[0].content).toContain("[Phase: tier]");
  });

  it("detects review phase", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    const hook = createPhaseReminderHook(config, runtime);

    runtime.prepareSessionContext("p3");

    const messages = [{ role: "assistant", content: "## Review: APPROVE\nThe code looks correct." }];
    await hook["experimental.chat.messages.transform"]?.(
      { sessionID: "p3" },
      { messages },
    );

    expect(messages[0].content).toContain("[Phase: review]");
  });

  it("warns when stuck in same phase", async () => {
    const config = makeConfig({ stuck_threshold: 2 });
    const runtime = makeRuntime();
    const hook = createPhaseReminderHook(config, runtime);

    runtime.prepareSessionContext("p4");

    for (let i = 0; i < 3; i++) {
      const msg = { role: "assistant", content: `Implementing feature X step ${i}` };
      await hook["experimental.chat.messages.transform"]?.(
        { sessionID: "p4" },
        { messages: [msg] },
      );
    }

    const lastMsg = { role: "assistant", content: "Implementing feature X step 3" };
    await hook["experimental.chat.messages.transform"]?.(
      { sessionID: "p4" },
      { messages: [lastMsg] },
    );

    expect(lastMsg.content).toContain("Stuck in phase");
  });

  it("skips non-assistant messages", async () => {
    const config = makeConfig();
    const runtime = makeRuntime();
    const hook = createPhaseReminderHook(config, runtime);

    runtime.prepareSessionContext("p5");

    const messages = [{ role: "user", content: "Please help" }];
    await hook["experimental.chat.messages.transform"]?.(
      { sessionID: "p5" },
      { messages },
    );

    expect(messages[0].content).not.toContain("[Phase:");
  });

  it("skips when disabled", async () => {
    const config = makeConfig({ phase_reminder: false });
    const runtime = makeRuntime();
    const hook = createPhaseReminderHook(config, runtime);

    runtime.prepareSessionContext("p6");

    const messages = [{ role: "assistant", content: "Implementing" }];
    await hook["experimental.chat.messages.transform"]?.(
      { sessionID: "p6" },
      { messages },
    );

    expect(messages[0].content).toBe("Implementing");
  });
});
