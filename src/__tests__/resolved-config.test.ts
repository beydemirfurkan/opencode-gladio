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
  const projectConfigDir = join(projectDir, ".opencode");
  mkdirSync(projectConfigDir, { recursive: true });
  return {
    projectDir,
    projectConfigPath: join(projectConfigDir, "opencode-gladio.jsonc"),
    userConfigPath: join(tempRoot, "user-opencode-gladio.jsonc"),
  };
}

describe("Resolved harness config pipeline", () => {
  it("normalizes missing schema_version and surfaces migration metadata", () => {
    const { projectDir, projectConfigPath, userConfigPath } = createTestPaths();
    writeFileSync(
      projectConfigPath,
      JSON.stringify({ hooks: { profile: "standard" } }, null, 2),
      "utf8",
    );

    const resolved = loadResolvedHarnessConfig(projectDir, {
      userConfigPath,
      projectConfigPath,
    });

    expect(resolved.schemaVersion).toBe(CURRENT_HARNESS_SCHEMA_VERSION);
    expect(resolved.effectiveConfig.schema_version).toBe(CURRENT_HARNESS_SCHEMA_VERSION);
    expect(resolved.sources.project.schemaVersion).toBe(CURRENT_HARNESS_SCHEMA_VERSION);
    expect(resolved.sources.project.exists).toBe(true);
    expect(resolved.sources.project.migrationWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Missing schema_version")]),
    );
    expect(resolved.sources.user.exists).toBe(false);
    expect(resolved.validationWarnings).toHaveLength(0);
  });

  it("warns about future schema versions but still loads the config", () => {
    const { projectDir, projectConfigPath, userConfigPath } = createTestPaths();
    const futureVersion = CURRENT_HARNESS_SCHEMA_VERSION + 5;
    writeFileSync(
      projectConfigPath,
      JSON.stringify({ schema_version: futureVersion, hooks: { profile: "standard" } }, null, 2),
      "utf8",
    );

    const resolved = loadResolvedHarnessConfig(projectDir, {
      userConfigPath,
      projectConfigPath,
    });

    expect(resolved.effectiveConfig.schema_version).toBe(futureVersion);
    expect(resolved.sources.project.schemaVersion).toBe(futureVersion);
    expect(resolved.migrationWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining("newer than supported")]),
    );
  });
});
