import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CURRENT_HARNESS_SCHEMA_VERSION,
  loadResolvedHarnessConfig,
} from "../config";

function createTestPaths() {
  const tempRoot = mkdtempSync(join(tmpdir(), "resolved-config-"));
  const projectDir = join(tempRoot, "project");
  mkdirSync(projectDir, { recursive: true });
  return {
    projectDir,
    userConfigPath: join(tempRoot, "user-opencode-gladio.jsonc"),
  };
}

describe("Resolved harness config pipeline", () => {
  it("normalizes missing schema_version and surfaces migration metadata", () => {
    const { projectDir, userConfigPath } = createTestPaths();
    writeFileSync(
      userConfigPath,
      JSON.stringify({ hooks: { profile: "standard" } }, null, 2),
      "utf8",
    );

    const resolved = loadResolvedHarnessConfig(projectDir, {
      userConfigPath,
    });

    expect(resolved.schemaVersion).toBe(CURRENT_HARNESS_SCHEMA_VERSION);
    expect(resolved.effectiveConfig.schema_version).toBe(CURRENT_HARNESS_SCHEMA_VERSION);
    expect(resolved.sources.user.exists).toBe(true);
    expect(resolved.sources.user.migrationWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Missing schema_version")]),
    );
    expect(resolved.validationWarnings).toHaveLength(0);
  });

  it("warns about future schema versions but still loads the config", () => {
    const { projectDir, userConfigPath } = createTestPaths();
    const futureVersion = CURRENT_HARNESS_SCHEMA_VERSION + 5;
    writeFileSync(
      userConfigPath,
      JSON.stringify({ schema_version: futureVersion, hooks: { profile: "standard" } }, null, 2),
      "utf8",
    );

    const resolved = loadResolvedHarnessConfig(projectDir, {
      userConfigPath,
    });

    expect(resolved.effectiveConfig.schema_version).toBe(futureVersion);
    expect(resolved.sources.user.schemaVersion).toBe(futureVersion);
    expect(resolved.migrationWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining("newer than supported")]),
    );
  });
});
