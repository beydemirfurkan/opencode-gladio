import type { HarnessConfig } from "../types";
import type { HookRuntime } from "./runtime";
import { resolveHooksConfig } from "./runtime";
import type { ProjectFacts } from "../project-facts";

type SkillEntry = {
  name: string;
  keywords: string[];
};

const SKILL_REGISTRY: SkillEntry[] = [
  { name: "vue-vite-ui", keywords: ["vue"] },
  { name: "frontend-design", keywords: ["react", "html", "css", "tailwind"] },
  { name: "frontend-design-ultimate", keywords: ["react", "next", "vite", "tailwind"] },
  { name: "nestjs-best-practices", keywords: ["nestjs", "@nestjs/core"] },
  { name: "go-fiber-postgres", keywords: ["go"] },
  { name: "rust-media-desktop", keywords: ["rust"] },
  { name: "seo-geo", keywords: ["next", "vite", "astro"] },
  { name: "insforge", keywords: ["react", "vue", "svelte"] },
  { name: "cartography", keywords: [] },
  { name: "programmatic-seo", keywords: ["next", "vite"] },
];

function prioritizeSkills(facts: ProjectFacts): Array<{ name: string; score: number }> {
  const allLanguages = new Set(facts.languages);
  const allFrameworks = new Set(facts.frameworks);
  const allDeps = new Set([...facts.languages, ...facts.frameworks]);

  const scored = SKILL_REGISTRY.map((skill) => {
    const matchCount = skill.keywords.filter((kw) => allDeps.has(kw)).length;
    return { name: skill.name, score: matchCount };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored;
}

export function createFilterAvailableSkillsHook(config: HarnessConfig, runtime: HookRuntime) {
  const hooksConfig = resolveHooksConfig(config);

  return {
    "experimental.chat.system.transform": async (
      input: { sessionID?: string },
      output: { system: string[] },
    ): Promise<void> => {
      if (hooksConfig.filter_skills === false) return;

      const sessionID = input.sessionID;
      if (!sessionID) return;

      const facts = runtime.detectProjectFacts();
      const prioritized = prioritizeSkills(facts);
      const relevant = prioritized.filter((entry) => entry.score > 0);

      if (relevant.length === 0) return;

      const topSkills = relevant.slice(0, 5).map((s) => s.name);
      const injection = `[SkillPriority] Based on project context, these skills are most relevant: ${topSkills.join(", ")}`;

      output.system[0] = output.system[0]
        ? `${injection}\n\n${output.system[0]}`
        : injection;
    },
  };
}
