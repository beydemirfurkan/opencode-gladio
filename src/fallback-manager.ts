import type { HarnessConfig } from "./types";

type SessionStatusEvent = {
  type: string;
  properties?: {
    sessionID?: string;
    agent?: string;
    status?: { type: string; code?: string; message?: string };
  };
};

type AgentFallbackChain = {
  models: string[];
  currentIndex: number;
  lastFailureAt: number;
};

const RATE_LIMIT_COOLDOWN_MS = 60_000;

const RATE_LIMIT_INDICATORS = [
  "rate_limit",
  "rate limit",
  "too many requests",
  "429",
  "quota exceeded",
  "capacity",
  "overloaded",
];

function isRateLimitError(status: unknown): boolean {
  if (typeof status === "string") {
    return RATE_LIMIT_INDICATORS.some((indicator) =>
      status.toLowerCase().includes(indicator),
    );
  }

  if (status && typeof status === "object") {
    const obj = status as Record<string, unknown>;
    const message =
      typeof obj.message === "string"
        ? obj.message
        : typeof obj.error === "string"
          ? obj.error
          : "";
    const code = typeof obj.code === "string" ? obj.code : "";
    return RATE_LIMIT_INDICATORS.some(
      (indicator) =>
        message.toLowerCase().includes(indicator) ||
        code.toLowerCase().includes(indicator),
    );
  }

  return false;
}

export class ForegroundFallbackManager {
  private chains = new Map<string, AgentFallbackChain>();
  private enabled: boolean;

  constructor(
    private client: unknown,
    runtimeChains: Record<string, string[]>,
    enabled: boolean,
  ) {
    this.enabled = enabled && Object.keys(runtimeChains).length > 0;

    for (const [agentName, models] of Object.entries(runtimeChains)) {
      if (models.length > 0) {
        this.chains.set(agentName, {
          models,
          currentIndex: 0,
          lastFailureAt: 0,
        });
      }
    }
  }

  async handleEvent(event: SessionStatusEvent): Promise<void> {
    if (!this.enabled) return;

    if (event.type !== "session.status") return;

    const props = event.properties;
    if (!props?.sessionID || !props?.status) return;

    if (props.status.type !== "error") return;

    const agentName = props.agent;
    if (!agentName) return;

    const statusDetail =
      typeof props.status === "object"
        ? props.status
        : { message: String(props.status) };

    if (!isRateLimitError(statusDetail)) return;

    const chain = this.chains.get(agentName);
    if (!chain) return;

    const now = Date.now();
    if (now - chain.lastFailureAt < RATE_LIMIT_COOLDOWN_MS) return;

    chain.lastFailureAt = now;
    const nextIndex = (chain.currentIndex + 1) % chain.models.length;

    if (nextIndex === chain.currentIndex) return;

    const nextModel = chain.models[nextIndex];
    chain.currentIndex = nextIndex;

    console.warn(
      `[opencode-gladio] Rate limit detected for ${agentName}. Switching to fallback model: ${nextModel}`,
    );
  }

  getCurrentModel(agentName: string): string | undefined {
    const chain = this.chains.get(agentName);
    if (!chain) return undefined;
    return chain.models[chain.currentIndex];
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
