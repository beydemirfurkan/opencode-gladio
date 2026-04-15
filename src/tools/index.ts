import { tool } from "@opencode-ai/plugin";
import type { ToolDefinition } from "@opencode-ai/plugin";
import type { MemoryStore, LearningCategory } from "../memory";

export function createGladioLearnTool(memory: MemoryStore): ToolDefinition {
  return tool({
    description:
      "Save a learning about this project for future sessions. Use this when you discover important conventions, patterns, pitfalls, architecture details, or dependency information that should persist across sessions.",
    args: {
      category: tool.schema.enum([
        "convention",
        "pattern",
        "pitfall",
        "architecture",
        "dependency",
      ]),
      content: tool.schema.string().describe("The learning to save. Be specific and concise."),
      confidence: tool.schema
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Confidence level 0-1. Default 0.8. Use 0.9+ for verified facts, 0.5-0.7 for observations."),
    },
    execute: async (args) => {
      const learning = memory.addLearning(
        args.category as LearningCategory,
        args.content,
        args.confidence ?? 0.8,
        "agent",
      );
      const total = memory.learningCount();
      return `Saved learning ${learning.id} [${learning.category}] conf=${learning.confidence}. Total: ${total}`;
    },
  });
}

export function createGladioRecallTool(memory: MemoryStore): ToolDefinition {
  return tool({
    description:
      "Query past learnings about this project. Use this before making assumptions about project conventions, patterns, or architecture. Returns matching learnings sorted by confidence.",
    args: {
      query: tool.schema
        .string()
        .optional()
        .describe("Search query to filter learnings by content. Omit to get all."),
      category: tool.schema
        .enum(["convention", "pattern", "pitfall", "architecture", "dependency"])
        .optional()
        .describe("Filter by category."),
      limit: tool.schema
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results to return. Default 10."),
    },
    execute: async (args) => {
      const results = memory.queryLearnings({
        query: args.query,
        category: args.category,
        limit: args.limit ?? 10,
      });

      if (results.length === 0) {
        return "No matching learnings found.";
      }

      return results
        .map(
          (l) =>
            `[${l.id}] (${l.category}, conf=${l.confidence}) ${l.content}`,
        )
        .join("\n");
    },
  });
}

export function createMemoryTools(memory: MemoryStore): Record<string, ToolDefinition> {
  return {
    "gladio-learn": createGladioLearnTool(memory),
    "gladio-recall": createGladioRecallTool(memory),
  };
}
