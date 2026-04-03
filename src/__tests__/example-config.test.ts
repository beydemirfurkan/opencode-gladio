import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, type ParseError } from "jsonc-parser";
import { HarnessConfigSchema } from "../config";

const testsDir = fileURLToPath(new URL(".", import.meta.url));
const configPath = join(testsDir, "..", "..", "examples", "opencode-gladio.jsonc");

describe("examples/opencode-gladio.jsonc", () => {
  it("matches the harness config schema", () => {
    const raw = readFileSync(configPath, "utf8");
    const errors: ParseError[] = [];
    const parsed = parse(raw, errors);
    expect(errors).toHaveLength(0);
    const result = HarnessConfigSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });
});
