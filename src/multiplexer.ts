import { spawn } from "node:child_process";
import type { MultiplexerConfig } from "./types";

type MultiplexerCommand = {
  name: string;
  hasSession: (sessionName: string) => Promise<boolean>;
  createPane: (sessionName: string, title: string) => Promise<void>;
  killPane: (sessionName: string, paneId: string) => Promise<void>;
  listPanes: (sessionName: string) => Promise<Array<{ id: string; title: string }>>;
};

const tmux: MultiplexerCommand = {
  name: "tmux",

  async hasSession(sessionName: string): Promise<boolean> {
    try {
      await run("tmux", ["has-session", "-t", sessionName]);
      return true;
    } catch {
      return false;
    }
  },

  async createPane(sessionName: string, title: string): Promise<void> {
    await run("tmux", [
      "split-window",
      "-t", sessionName,
      "-P",
      "-F", "#{pane_id}",
      ...(title ? ["-n", title] : []),
    ]);
  },

  async killPane(_sessionName: string, paneId: string): Promise<void> {
    await run("tmux", ["kill-pane", "-t", paneId]);
  },

  async listPanes(sessionName: string): Promise<Array<{ id: string; title: string }>> {
    try {
      const output = await run("tmux", [
        "list-panes",
        "-t", sessionName,
        "-F", "#{pane_id}:#{pane_title}",
      ]);
      return output
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [id, ...rest] = line.split(":");
          return { id, title: rest.join(":") };
        });
    } catch {
      return [];
    }
  },
};

const zellij: MultiplexerCommand = {
  name: "zellij",

  async hasSession(sessionName: string): Promise<boolean> {
    try {
      const output = await run("zellij", ["list-sessions"]);
      return output.split("\n").some((line) => line.startsWith(sessionName));
    } catch {
      return false;
    }
  },

  async createPane(_sessionName: string, _title: string): Promise<void> {
    console.warn("[opencode-gladio] Zellij pane creation not yet implemented");
  },

  async killPane(_sessionName: string, _paneId: string): Promise<void> {
    console.warn("[opencode-gladio] Zellij pane kill not yet implemented");
  },

  async listPanes(_sessionName: string): Promise<Array<{ id: string; title: string }>> {
    return [];
  },
};

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on("data", () => {});
    child.on("error", reject);
    child.on("exit", (code) => {
      const output = Buffer.concat(chunks).toString("utf8").trim();
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

export function getMultiplexer(
  config: MultiplexerConfig,
): MultiplexerCommand | null {
  if (config.type === "none" || !config.type) return null;

  switch (config.type) {
    case "tmux":
      return tmux;
    case "zellij":
      return zellij;
    default:
      return null;
  }
}

export function isMultiplexerAvailable(
  multiplexer: MultiplexerCommand | null,
): boolean {
  return multiplexer !== null;
}

const GLADIO_SESSION_PREFIX = "gladio-";

function workerSessionName(sessionID: string): string {
  return `${GLADIO_SESSION_PREFIX}${sessionID.slice(0, 12)}`;
}

export class MultiplexerSessionManager {
  private multiplexer: MultiplexerCommand | null;
  private activePanes = new Map<string, string[]>();

  constructor(config: MultiplexerConfig) {
    this.multiplexer = getMultiplexer(config);
  }

  async onSessionCreated(event: {
    type: string;
    properties?: {
      info?: { id?: string; parentID?: string; title?: string };
    };
  }): Promise<void> {
    if (!this.multiplexer) return;

    const sessionID = event.properties?.info?.id;
    const title = event.properties?.info?.title;
    const parentID = event.properties?.info?.parentID;

    if (!sessionID || !parentID || !title) return;

    if (!title.toLowerCase().includes("polat")) return;

    const sessionName = workerSessionName(sessionID);

    try {
      const exists = await this.multiplexer.hasSession(sessionName);
      if (!exists) return;

      await this.multiplexer.createPane(sessionName, title);
      const panes = this.activePanes.get(sessionID) ?? [];
      panes.push(sessionID);
      this.activePanes.set(sessionID, panes);
    } catch {
      // swallow multiplexer errors
    }
  }

  async onSessionStatus(event: {
    type: string;
    properties?: { sessionID?: string; status?: { type: string } };
  }): Promise<void> {
    if (!this.multiplexer) return;

    const sessionID = event.properties?.sessionID;
    const statusType = event.properties?.status?.type;

    if (sessionID && statusType === "completed") {
      await this.cleanupPanes(sessionID);
    }
  }

  async onSessionDeleted(event: {
    type: string;
    properties?: { info?: { id?: string }; sessionID?: string };
  }): Promise<void> {
    if (!this.multiplexer) return;

    const sessionID =
      event.properties?.info?.id ?? event.properties?.sessionID;
    if (sessionID) {
      await this.cleanupPanes(sessionID);
    }
  }

  private async cleanupPanes(sessionID: string): Promise<void> {
    const paneIds = this.activePanes.get(sessionID);
    if (!paneIds || paneIds.length === 0) return;

    const sessionName = workerSessionName(sessionID);
    for (const paneId of paneIds) {
      try {
        await this.multiplexer?.killPane(sessionName, paneId);
      } catch {
        // swallow
      }
    }
    this.activePanes.delete(sessionID);
  }
}
