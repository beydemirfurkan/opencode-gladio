import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CURRENT_HARNESS_SCHEMA_VERSION } from "../config";
import { buildManagedPluginEntries, getConfigPaths } from "../installer";
import {
  determineDoctorExitCode,
  runDoctor,
  type DoctorCheck,
  type DoctorOptions,
  type DoctorReport,
} from "../doctor";

function prepareDoctorEnvironment(
  overrides?: {
    schemaVersion?: number;
    pluginEntries?: (paths: ReturnType<typeof getConfigPaths>) => string[];
    omitDist?: boolean;
  },
): { options: DoctorOptions; configDir: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "doctor-"));
  const configDir = join(root, "config-dir");
  mkdirSync(configDir, { recursive: true });
  const paths = getConfigPaths(configDir);

  const pluginEntries =
    overrides?.pluginEntries?.(paths) ??
    buildManagedPluginEntries();
  writeFileSync(
    paths.configJson,
    JSON.stringify({ plugin: pluginEntries }, null, 2),
    "utf8",
  );

  writeFileSync(
    paths.packageJson,
    JSON.stringify({ name: "doctor-config" }, null, 2),
    "utf8",
  );

  const harnessDir = join(configDir, "node_modules", "opencode-gladio");
  const distDir = join(harnessDir, "dist");
  const srcDir = join(harnessDir, "src");
  mkdirSync(distDir, { recursive: true });
  mkdirSync(srcDir, { recursive: true });

  if (!overrides?.omitDist) {
    writeFileSync(join(distDir, "index.js"), "", "utf8");
  }
  writeFileSync(join(srcDir, "index.ts"), "", "utf8");

  const projectDir = join(root, "project");
  const projectConfigDir = join(projectDir, ".opencode");
  mkdirSync(projectConfigDir, { recursive: true });
  const projectConfigPath = join(projectConfigDir, "opencode-gladio.jsonc");

  const schemaVersion = overrides?.schemaVersion ?? CURRENT_HARNESS_SCHEMA_VERSION;
  writeFileSync(
    projectConfigPath,
    JSON.stringify({ schema_version: schemaVersion }, null, 2),
    "utf8",
  );

  const userConfigPath = join(root, "user-opencode-gladio.jsonc");
  writeFileSync(
    userConfigPath,
    JSON.stringify({ schema_version: schemaVersion }, null, 2),
    "utf8",
  );

  const configDirOptions: DoctorOptions = {
    configDir,
    projectDirectory: projectDir,
    projectConfigPath,
    userConfigPath,
  };

  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;
  process.env.OPENCODE_CONFIG_DIR = configDir;
  const cleanup = () => {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }
  };

  return { options: configDirOptions, configDir, cleanup };
}

describe("Doctor command helpers", () => {
  it("reports PASS for a healthy harness", () => {
    const { options, cleanup } = prepareDoctorEnvironment();
    try {
      const report = runDoctor(options);
      expect(report.overallStatus).toBe("PASS");
      const managedCheck = report.checks.find((check) => check.name === "Managed plugins");
      expect(managedCheck?.status).toBe("PASS");
    } finally {
      cleanup();
    }
  });

  it("reports WARN when schema version is ahead of support", () => {
    const { options, cleanup } = prepareDoctorEnvironment({
      schemaVersion: CURRENT_HARNESS_SCHEMA_VERSION + 3,
    });
    try {
      const report = runDoctor(options);
      expect(report.overallStatus).toBe("WARN");
      const configCheck = report.checks.find((check) => check.name === "Config validation");
      expect(configCheck?.status).toBe("WARN");
      expect(configCheck?.details.some((detail) => detail.includes("newer than supported"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("reports FAIL when managed plugin list drops required entries", () => {
    const { options, cleanup } = prepareDoctorEnvironment({
      pluginEntries: () => [],
    });
    try {
      const report = runDoctor(options);
      expect(report.overallStatus).toBe("FAIL");
      const managedCheck = report.checks.find((check) => check.name === "Managed plugins");
      expect(managedCheck?.status).toBe("FAIL");
      expect(managedCheck?.details[0]).toContain("Missing managed entries");
    } finally {
      cleanup();
    }
  });
});

describe("Doctor exit code behavior", () => {
  const baseReport: DoctorReport = {
    overallStatus: "PASS",
    checks: [] as DoctorCheck[],
    metadata: {
      configDir: "/tmp",
      projectDirectory: "/tmp",
      mainConfigPath: "/tmp/opencode.json",
      schemaVersion: CURRENT_HARNESS_SCHEMA_VERSION,
      checkedAt: new Date().toISOString(),
    },
  };

  it("returns 1 for WARN when strict", () => {
    const report: DoctorReport = { ...baseReport, overallStatus: "WARN" };
    expect(determineDoctorExitCode(report, true)).toBe(1);
    expect(determineDoctorExitCode(report, false)).toBe(0);
  });

  it("returns 1 for FAIL regardless of strict", () => {
    const report: DoctorReport = { ...baseReport, overallStatus: "FAIL" };
    expect(determineDoctorExitCode(report, true)).toBe(1);
    expect(determineDoctorExitCode(report, false)).toBe(1);
  });
});
