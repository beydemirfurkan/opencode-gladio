import type { Plugin } from "@opencode-ai/plugin";
import { loadHarnessConfig } from "./config";
import { createHarnessAgents } from "./agents";
import { createHarnessMcps } from "./mcp";
import { createHarnessCommands } from "./commands";
import { createHarnessHooks } from "./hooks";
import { ForegroundFallbackManager } from "./fallback-manager";
import { MultiplexerSessionManager } from "./multiplexer";

const OpenCodeGladioPlugin: Plugin = async (ctx) => {
  const harnessConfig = loadHarnessConfig(ctx.directory);
  const hooks = await createHarnessHooks(ctx, harnessConfig);
  const fallbackManager = new ForegroundFallbackManager(
    ctx.client,
    harnessConfig.fallbacks?.chains ?? {},
    harnessConfig.fallbacks?.enabled !== false,
  );
  const multiplexerManager = new MultiplexerSessionManager(
    harnessConfig.multiplexer ?? { type: "none" },
  );

  return {
    config: async (config) => {
      const mutableConfig = config as unknown as Record<string, unknown>;
      const existingAgents = (mutableConfig.agent ?? {}) as Record<string, unknown>;
      const existingMcps = (mutableConfig.mcp ?? {}) as Record<string, unknown>;
      const existingCommands = (mutableConfig.command ?? {}) as Record<string, unknown>;
      const harnessAgents = createHarnessAgents(harnessConfig);
      const harnessMcps = createHarnessMcps(harnessConfig);
      const harnessCommands = createHarnessCommands(harnessConfig);

      mutableConfig.agent = { ...existingAgents, ...harnessAgents };
      mutableConfig.mcp = { ...existingMcps, ...harnessMcps };
      mutableConfig.command = { ...harnessCommands, ...existingCommands };

      if (harnessConfig.set_default_agent !== false) {
        mutableConfig.default_agent = "polat";
      }

      await hooks.config?.(config);
    },
    ...(hooks["chat.message"] ? { "chat.message": hooks["chat.message"] } : {}),
    ...(hooks.event
      ? {
          event: async (input) => {
            await fallbackManager.handleEvent(input.event as any);
            await multiplexerManager.onSessionCreated(input.event as any);
            await multiplexerManager.onSessionStatus(input.event as any);
            await multiplexerManager.onSessionDeleted(input.event as any);
            await hooks.event?.(input);
          },
        }
      : {}),
    ...(hooks["tool.execute.before"]
      ? { "tool.execute.before": hooks["tool.execute.before"] }
      : {}),
    ...(hooks["tool.execute.after"]
      ? { "tool.execute.after": hooks["tool.execute.after"] }
      : {}),
    ...(hooks["file.edited"] ? { "file.edited": hooks["file.edited"] } : {}),
    ...(hooks["session.created"] ? { "session.created": hooks["session.created"] } : {}),
    ...(hooks["session.idle"] ? { "session.idle": hooks["session.idle"] } : {}),
    ...(hooks["session.deleted"] ? { "session.deleted": hooks["session.deleted"] } : {}),
    ...(hooks["experimental.session.compacting"]
      ? { "experimental.session.compacting": hooks["experimental.session.compacting"] }
      : {}),
    ...(hooks["experimental.chat.system.transform"]
      ? {
          "experimental.chat.system.transform": hooks["experimental.chat.system.transform"],
        }
      : {}),
  };
};

export default OpenCodeGladioPlugin;
