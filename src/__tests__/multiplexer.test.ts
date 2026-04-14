import { describe, expect, it } from "bun:test";
import { MultiplexerSessionManager } from "../multiplexer";

describe("MultiplexerSessionManager", () => {
  it("does nothing when type is none", async () => {
    const manager = new MultiplexerSessionManager({ type: "none" });
    await manager.onSessionCreated({
      type: "session.created",
      properties: {
        info: { id: "s1", parentID: "parent", title: "polat session" },
      },
    });
  });

  it("handles session deleted gracefully", async () => {
    const manager = new MultiplexerSessionManager({ type: "tmux" });
    await manager.onSessionDeleted({
      type: "session.deleted",
      properties: { info: { id: "s1" } },
    });
  });

  it("handles session status completed gracefully", async () => {
    const manager = new MultiplexerSessionManager({ type: "tmux" });
    await manager.onSessionStatus({
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "completed" } },
    });
  });

  it("skips non-polat sessions", async () => {
    const manager = new MultiplexerSessionManager({ type: "tmux" });
    await manager.onSessionCreated({
      type: "session.created",
      properties: {
        info: { id: "s1", parentID: "parent", title: "memati session" },
      },
    });
  });

  it("handles missing properties gracefully", async () => {
    const manager = new MultiplexerSessionManager({ type: "tmux" });
    await manager.onSessionCreated({ type: "session.created" });
    await manager.onSessionStatus({ type: "session.status" });
    await manager.onSessionDeleted({ type: "session.deleted" });
  });
});
