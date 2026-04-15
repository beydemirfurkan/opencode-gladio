export type TierLevel = 1 | 2 | 3 | 4;

export const TIER_WORKERS: Record<TierLevel, string[]> = {
  1: [],
  2: ["memati", "halit"],
  3: ["memati", "halit", "aslan-akbey", "iskender", "tuncay"],
  4: ["memati", "halit", "aslan-akbey", "iskender", "tuncay", "pala"],
};

export function getWorkersForTier(tier: TierLevel): string[] {
  return TIER_WORKERS[tier];
}

export function classifyTaskComplexity(description: string): TierLevel {
  const lower = description.toLowerCase();

  const tier4Indicators = ["payment", "credit card", "production data", "migration", "database migration", "financial"];
  const tier3Indicators = ["auth", "authentication", "authorization", "database", "public api", "api endpoint", "security", "config change", "environment variable"];
  const tier2Indicators = ["refactor", "rename", "update", "move", "extract", "reorganize"];
  const tier1Indicators = ["typo", "fix typo", "comment", "log", "rename variable", "format", "lint", "whitespace"];

  if (tier4Indicators.some((i) => lower.includes(i))) return 4;
  if (tier3Indicators.some((i) => lower.includes(i))) return 3;
  if (tier2Indicators.some((i) => lower.includes(i))) return 2;
  if (tier1Indicators.some((i) => lower.includes(i))) return 1;

  return 2;
}
