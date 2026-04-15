const FULL_MODEL = "openai/gpt-5.4";
const FAST_MODEL = "openai/gpt-5.4-mini";

export type TierLevel = 1 | 2 | 3 | 4;

type AgentTierModel = {
  high_tier: string;
  low_tier: string;
};

const AGENT_MODEL_MAP: Record<string, AgentTierModel> = {
  polat: { high_tier: FULL_MODEL, low_tier: FULL_MODEL },
  cakir: { high_tier: FULL_MODEL, low_tier: FAST_MODEL },
  memati: { high_tier: FULL_MODEL, low_tier: FULL_MODEL },
  abdulhey: { high_tier: FULL_MODEL, low_tier: FAST_MODEL },
  "aslan-akbey": { high_tier: FULL_MODEL, low_tier: FULL_MODEL },
  iskender: { high_tier: FULL_MODEL, low_tier: FULL_MODEL },
  tuncay: { high_tier: FULL_MODEL, low_tier: FAST_MODEL },
  halit: { high_tier: FAST_MODEL, low_tier: FAST_MODEL },
  "gullu-erhan": { high_tier: FULL_MODEL, low_tier: FULL_MODEL },
  "laz-ziya": { high_tier: FAST_MODEL, low_tier: FAST_MODEL },
  pala: { high_tier: FULL_MODEL, low_tier: FAST_MODEL },
};

const TIER_THRESHOLD: TierLevel = 3;

export function resolveAgentModel(agentName: string, tier: TierLevel): string {
  const mapping = AGENT_MODEL_MAP[agentName];
  if (!mapping) return FULL_MODEL;
  return tier >= TIER_THRESHOLD ? mapping.high_tier : mapping.low_tier;
}

export function resolveAgentVariant(agentName: string): string | undefined {
  const alwaysHigh = new Set(["polat", "aslan-akbey", "iskender", "memati", "gullu-erhan"]);
  if (alwaysHigh.has(agentName)) return "high";
  return "none";
}

export function getEffectiveModel(
  agentName: string,
  tier: TierLevel,
  userOverride?: string,
): string {
  if (userOverride) return userOverride;
  return resolveAgentModel(agentName, tier);
}
