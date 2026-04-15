import type { PluginInput } from "@opencode-ai/plugin";
import type { HarnessConfig } from "../types";
import type { MemoryStore } from "../memory";
import { createPostToolUseHook } from "./post-tool-use";
import { createPreToolUseHook } from "./pre-tool-use";
import { createHookRuntime, resolveHookProfile } from "./runtime";
import { safeCreateHook, safeHook } from "./sdk";
import { createSessionEndHook } from "./session-end";
import { createSessionStartHook } from "./session-start";
import { createStopHook } from "./stop";
import { createSystemPromptHook } from "./system-prompt";
import { createPhaseReminderHook } from "./phase-reminder";
import { createTodoContinuationHook } from "./todo-continuation";
import { createApplyPatchHook } from "./apply-patch";
import { createJsonErrorRecoveryHook } from "./json-error-recovery";
import { createDelegateTaskRetryHook } from "./delegate-task-retry";
import { createFilterAvailableSkillsHook } from "./filter-available-skills";
import { createChatHeadersHook } from "./chat-headers";

type HookRecord = {
  config?: (config: any) => Promise<void>;
  "chat.message"?: (input: any, output: any) => Promise<void>;
  event?: (input: { event: { type: string; properties?: unknown } }) => Promise<void>;
  "tool.execute.before"?: (input: any) => Promise<void>;
  "tool.execute.after"?: (input: any, output: any) => Promise<void>;
  "session.created"?: (input?: any) => Promise<void>;
  "session.idle"?: (input?: any) => Promise<void>;
  "session.deleted"?: (input?: any) => Promise<void>;
  "experimental.chat.system.transform"?: (input: any, output: any) => Promise<void>;
  "experimental.chat.messages.transform"?: (input: any, output: any) => Promise<void>;
};

function wrapHookRecord(name: string, hook: HookRecord | undefined): HookRecord | undefined {
  if (!hook) return undefined;
  return {
    config: safeHook(`${name}.config`, hook.config),
    "chat.message": safeHook(`${name}.chat.message`, hook["chat.message"]),
    event: safeHook(`${name}.event`, hook.event),
    "tool.execute.before": safeHook(`${name}.tool.execute.before`, hook["tool.execute.before"]),
    "tool.execute.after": safeHook(`${name}.tool.execute.after`, hook["tool.execute.after"]),
    "session.created": safeHook(`${name}.session.created`, hook["session.created"]),
    "session.idle": safeHook(`${name}.session.idle`, hook["session.idle"]),
    "session.deleted": safeHook(`${name}.session.deleted`, hook["session.deleted"]),
    "experimental.chat.system.transform": safeHook(`${name}.experimental.chat.system.transform`, hook["experimental.chat.system.transform"]),
    "experimental.chat.messages.transform": safeHook(`${name}.experimental.chat.messages.transform`, hook["experimental.chat.messages.transform"]),
  };
}

function composeChatMessage(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook["chat.message"]).filter(Boolean);
  if (active.length === 0) return undefined;
  return async (input: any, output: any) => {
    for (const hook of active) await hook?.(input, output);
  };
}

function composeConfig(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook.config).filter(Boolean);
  if (active.length === 0) return undefined;
  return async (config: any) => {
    for (const hook of active) await hook?.(config);
  };
}

function composeEvent(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook.event).filter(Boolean);
  if (active.length === 0) return undefined;
  return async (input: { event: { type: string; properties?: unknown } }) => {
    for (const hook of active) await hook?.(input);
  };
}

function composeToolBefore(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook["tool.execute.before"]).filter(Boolean);
  if (active.length === 0) return undefined;
  return async (input: any) => {
    for (const hook of active) await hook?.(input);
  };
}

function composeToolAfter(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook["tool.execute.after"]).filter(Boolean);
  if (active.length === 0) return undefined;
  return async (input: any, output: any) => {
    for (const hook of active) await hook?.(input, output);
  };
}

function composeSingleArg(hooks: HookRecord[], key: keyof HookRecord) {
  const active = hooks.map((hook) => hook[key]).filter(Boolean) as Array<(input: any) => Promise<void>>;
  if (active.length === 0) return undefined;
  return async (input: any) => {
    for (const hook of active) await hook(input);
  };
}

function composeSystemTransform(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook["experimental.chat.system.transform"]).filter(Boolean);
  if (active.length === 0) return undefined;
  return async (input: any, output: any) => {
    for (const hook of active) await hook?.(input, output);
  };
}

function composeMessagesTransform(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook["experimental.chat.messages.transform"]).filter(Boolean);
  if (active.length === 0) return undefined;
  return async (input: any, output: any) => {
    for (const hook of active) await hook?.(input, output);
  };
}

function composeSessionIdle(hooks: HookRecord[]) {
  const active = hooks.map((hook) => hook["session.idle"]).filter(Boolean) as Array<(input?: any) => Promise<void>>;
  if (active.length === 0) return undefined;
  return async (input?: any) => {
    for (const hook of active) await hook(input);
  };
}

export async function createHarnessHooks(ctx: PluginInput, config: HarnessConfig, memory?: MemoryStore) {
  const hooks: HookRecord[] = [];
  const profile = resolveHookProfile(config);
  const runtime = createHookRuntime(ctx, config, memory);

  const registerHook = (name: string, enabled: boolean, factory: () => HookRecord) => {
    if (!enabled) return;
    const hook = wrapHookRecord(name, safeCreateHook(name, factory));
    if (hook) hooks.push(hook);
  };

  registerHook("session_start", config.hooks?.session_start !== false, () =>
    createSessionStartHook(ctx, config, runtime),
  );
  registerHook("pre_tool_use", config.hooks?.pre_tool_use !== false, () =>
    createPreToolUseHook(config, runtime, profile),
  );
  registerHook("post_tool_use", config.hooks?.post_tool_use !== false, () =>
    createPostToolUseHook(config, runtime, profile),
  );
  registerHook("todo_continuation", config.hooks?.todo_continuation !== false, () =>
    createTodoContinuationHook(config, runtime),
  );
  registerHook("stop", config.hooks?.stop !== false, () => createStopHook(ctx, config, runtime));
  registerHook("session_end", config.hooks?.session_end !== false, () =>
    createSessionEndHook(config, runtime),
  );
  registerHook("system_prompt", true, () => createSystemPromptHook(runtime));
  registerHook("phase_reminder", config.hooks?.phase_reminder !== false, () =>
    createPhaseReminderHook(config, runtime),
  );
  registerHook("apply_patch", config.hooks?.apply_patch_rescue !== false, () =>
    createApplyPatchHook(config, runtime),
  );
  registerHook("json_error_recovery", config.hooks?.json_error_recovery !== false, () =>
    createJsonErrorRecoveryHook(config, runtime),
  );
  registerHook("delegate_retry", config.hooks?.delegate_retry !== false, () =>
    createDelegateTaskRetryHook(config, runtime),
  );
  registerHook("filter_skills", config.hooks?.filter_skills !== false, () =>
    createFilterAvailableSkillsHook(config, runtime),
  );
  registerHook("chat_headers", config.hooks?.chat_headers !== false, () =>
    createChatHeadersHook(config, runtime),
  );

  return {
    config: composeConfig(hooks),
    "chat.message": composeChatMessage(hooks),
    event: composeEvent(hooks),
    "tool.execute.before": composeToolBefore(hooks),
    "tool.execute.after": composeToolAfter(hooks),
    "session.created": composeSingleArg(hooks, "session.created"),
    "session.idle": composeSessionIdle(hooks),
    "session.deleted": composeSingleArg(hooks, "session.deleted"),
    "experimental.chat.system.transform": composeSystemTransform(hooks),
    "experimental.chat.messages.transform": composeMessagesTransform(hooks),
  };
}
