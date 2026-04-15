import type { AgentOverride, HarnessConfig } from "./types";

export type FallbackRole = "coordinator" | "verifier";

export type FallbackCandidate = {
  model?: string;
  variant?: string;
};

export type FallbackSelectionSource = "primary" | `fallback[${number}]`;

export type ResolvedRoleFallback = {
  role: FallbackRole;
  primaryCandidate: FallbackCandidate;
  configuredFallbacks: FallbackCandidate[];
  selectedCandidate: FallbackCandidate;
  selectedSource: FallbackSelectionSource;
  selectedReason: string;
  degraded: boolean;
};

export type ResolvedFallbackState = {
  coordinator: ResolvedRoleFallback;
  verifier: ResolvedRoleFallback;
};

export const DEFAULT_PRIMARY_CANDIDATES: Record<FallbackRole, FallbackCandidate> = {
  coordinator: { variant: "high" },
  verifier: { variant: "none" },
};

export const DEFAULT_FALLBACK_CONFIG: Record<FallbackRole, FallbackCandidate[]> = {
  coordinator: [],
  verifier: [],
};

function normalizeCandidate(candidate: FallbackCandidate): FallbackCandidate {
  return {
    model: candidate.model,
    variant: candidate.variant,
  };
}

function normalizeFallbackEntry(entry: string | FallbackCandidate): FallbackCandidate {
  if (typeof entry === "string") {
    return { model: entry };
  }

  return normalizeCandidate(entry);
}

function describeCandidate(candidate: FallbackCandidate): string {
  const model = candidate.model ?? "<default model>";
  const variant = candidate.variant ?? "none";
  return `${model}/${variant}`;
}

function buildPrimaryCandidate(
  role: FallbackRole,
  config: HarnessConfig,
): FallbackCandidate {
  const agentName = role === "coordinator" ? "polat" : "halit";
  const override: AgentOverride | undefined = config.agents?.[agentName];
  const baseCandidate = { ...DEFAULT_PRIMARY_CANDIDATES[role] };

  if (override?.model) {
    baseCandidate.model = override.model;
  }

  if (override?.variant) {
    baseCandidate.variant = override.variant;
  }

  return baseCandidate;
}

function buildConfiguredFallbacks(
  role: FallbackRole,
  config: HarnessConfig,
): FallbackCandidate[] {
  const agentName = role === "coordinator" ? "polat" : "halit";
  const configuredForRole = config.fallbacks?.[role];
  const configured =
    Array.isArray(configuredForRole) && configuredForRole.length > 0
      ? configuredForRole
      : config.fallbacks?.chains?.[agentName];

  if (Array.isArray(configured)) {
    return configured.map((entry) => normalizeFallbackEntry(entry));
  }

  return DEFAULT_FALLBACK_CONFIG[role].map((entry) => normalizeCandidate(entry));
}

function selectCandidateFromChain(chain: FallbackCandidate[]): {
  index: number;
  reason: string;
  degraded: boolean;
} {
  if (chain.length === 0) {
    return {
      index: 0,
      reason: "No candidates configured; defaulting to primary.",
      degraded: true,
    };
  }

  const candidate = chain[0];
  return {
    index: 0,
    reason: `Using primary candidate ${describeCandidate(candidate)}.`,
    degraded: false,
  };
}

export function resolveFallbackState(config: HarnessConfig): ResolvedFallbackState {
  const buildRole = (role: FallbackRole): ResolvedRoleFallback => {
    const primaryCandidate = buildPrimaryCandidate(role, config);
    const configuredFallbacks = buildConfiguredFallbacks(role, config);
    const chain = [primaryCandidate, ...configuredFallbacks];
    const selection = selectCandidateFromChain(chain);
    const selectedCandidate = chain[selection.index] ?? primaryCandidate;

    const source: FallbackSelectionSource =
      selection.index === 0 ? "primary" : `fallback[${selection.index - 1}]`;

    return {
      role,
      primaryCandidate,
      configuredFallbacks,
      selectedCandidate,
      selectedSource: source,
      selectedReason: selection.reason,
      degraded: selection.degraded,
    };
  };

  return {
    coordinator: buildRole("coordinator"),
    verifier: buildRole("verifier"),
  };
}
