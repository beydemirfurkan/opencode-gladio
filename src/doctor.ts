import { existsSync } from "node:fs";
import { join } from "node:path";
import type { LoadHarnessConfigOptions } from "./config";
import {
  CURRENT_HARNESS_SCHEMA_VERSION,
  loadResolvedHarnessConfig,
  type ResolvedHarnessConfig,
} from "./config";
import type { ResolvedRoleFallback } from "./fallbacks";
import {
  buildManagedPluginEntries,
  detectMainConfigPath,
  getConfigDir,
  getConfigPaths,
  readJsonLike,
} from "./installer";

export type DoctorStatus = "PASS" | "WARN" | "FAIL";

export type DoctorCheck = {
  name: string;
  status: DoctorStatus;
  summary: string;
  details: string[];
};

export type DoctorReport = {
  overallStatus: DoctorStatus;
  checks: DoctorCheck[];
  metadata: {
    configDir: string;
    projectDirectory: string;
    mainConfigPath: string;
    schemaVersion: number;
    checkedAt: string;
  };
};

export type DoctorOptions = LoadHarnessConfigOptions & {
  projectDirectory?: string;
  configDir?: string;
};

const STATUS_PRIORITY: Record<DoctorStatus, number> = {
  PASS: 1,
  WARN: 2,
  FAIL: 3,
};

function mergeStatus(current: DoctorStatus, candidate: DoctorStatus): DoctorStatus {
  return STATUS_PRIORITY[candidate] > STATUS_PRIORITY[current]
    ? candidate
    : current;
}

function checkConfig(resolved: ResolvedHarnessConfig): DoctorCheck {
  const details: string[] = [];
  let status: DoctorStatus = "PASS";

  if (resolved.schemaVersion > CURRENT_HARNESS_SCHEMA_VERSION) {
    status = mergeStatus(status, "WARN");
    details.push(
      `Schema version ${resolved.schemaVersion} is newer than supported ${CURRENT_HARNESS_SCHEMA_VERSION}.`,
    );
  }

  if (resolved.migrationWarnings.length > 0) {
    status = mergeStatus(status, "WARN");
    details.push(
      `Migration warnings: ${resolved.migrationWarnings.join("; ")}`,
    );
  }

  if (resolved.validationWarnings.length > 0) {
    status = mergeStatus(status, "WARN");
    details.push(
      `Validation warnings: ${resolved.validationWarnings.join("; ")}`,
    );
  }

  if (details.length === 0) {
    details.push("No migration or validation warnings detected.");
  }

  const summary =
    status === "PASS"
      ? "Config parsed and validated cleanly."
      : "Config is valid but reported migration or validation warnings.";

  return {
    name: "Config validation",
    status,
    summary,
    details,
  };
}

function checkInstallArtifacts(
  paths: ReturnType<typeof getConfigPaths>,
  mainConfigPath: string,
): DoctorCheck {
  const details: string[] = [];
  let status: DoctorStatus = "PASS";

  if (!existsSync(paths.configDir)) {
    status = mergeStatus(status, "FAIL");
    details.push(`Config directory missing: ${paths.configDir}`);
  }

  if (!existsSync(mainConfigPath)) {
    status = mergeStatus(status, "WARN");
    details.push(`Main opencode config missing: ${mainConfigPath}`);
  }

  if (!existsSync(paths.packageJson)) {
    status = mergeStatus(status, "WARN");
    details.push(`package.json missing: ${paths.packageJson}`);
  }

  const harnessModule = join(paths.configDir, "node_modules", "opencode-gladio");
  if (!existsSync(harnessModule)) {
    status = mergeStatus(status, "WARN");
    details.push(`Harness install missing: ${harnessModule}`);
  } else {
    const distEntry = join(harnessModule, "dist", "index.js");
    const sourceEntry = join(harnessModule, "src", "index.ts");

    if (!existsSync(distEntry)) {
      status = mergeStatus(status, "WARN");
      const label = existsSync(sourceEntry)
        ? "Build output not found."
        : "Build output and sources missing.";
      details.push(`${label} Expected ${distEntry}`);
    }

    if (!existsSync(sourceEntry)) {
      status = mergeStatus(status, "WARN");
      details.push(`Source entry missing: ${sourceEntry}`);
    }
  }

  if (details.length === 0) {
    details.push("Config directory and harness artifacts present.");
  }

  const summary =
    status === "PASS"
      ? "Install artifacts appear complete."
      : "Install artifacts may be incomplete.";

  return {
    name: "Install artifacts",
    status,
    summary,
    details,
  };
}

function checkManagedPlugins(
  paths: ReturnType<typeof getConfigPaths>,
  mainConfigPath: string,
): DoctorCheck {
  const configState = readJsonLike(mainConfigPath);
  const existingPlugin = Array.isArray(configState.plugin)
    ? configState.plugin.filter((entry): entry is string => typeof entry === "string")
    : [];
  const expected = buildManagedPluginEntries(paths.vendorDir);
  const missing = expected.filter((entry) => !existingPlugin.includes(entry));
  const status: DoctorStatus = missing.length === 0 ? "PASS" : "FAIL";
  const details = missing.length
    ? [`Missing managed entries: ${missing.join(", ")}`]
    : ["All managed plugin entries are present."];
  const summary =
    status === "PASS"
      ? "Managed plugin list is complete."
      : "Managed plugins need attention; missing entries detected.";
  return {
    name: "Managed plugins",
    status,
    summary,
    details,
  };
}

function describeCandidate(candidate: ResolvedRoleFallback["primaryCandidate"]): string {
  const model = candidate.model ?? "<unspecified model>";
  const variant = candidate.variant ?? "none";
  return `${model}/${variant}`;
}

function formatRoleFallbackDetails(
  label: string,
  roleState: ResolvedRoleFallback,
): string[] {
  const lines: string[] = [];
  lines.push(`${label} fallback chain:`);
  lines.push(`- primary: ${describeCandidate(roleState.primaryCandidate)}`);
  if (roleState.configuredFallbacks.length > 0) {
    roleState.configuredFallbacks.forEach((candidate, index) => {
      lines.push(`- fallback[${index}]: ${describeCandidate(candidate)}`);
    });
  } else {
    lines.push(`- fallback: <none configured>`);
  }

  lines.push(
    `Selected: ${describeCandidate(roleState.selectedCandidate)} (${roleState.selectedSource})`,
  );
  lines.push(`Reason: ${roleState.selectedReason}`);
  lines.push(`Degraded: ${roleState.degraded ? "yes" : "no"}`);

  return lines;
}

function checkAgentFallback(resolved: ResolvedHarnessConfig): DoctorCheck {
  const fallbackState = resolved.fallbackState;
  const coordinatorDetails = formatRoleFallbackDetails("Coordinator (polat)",
    fallbackState.coordinator);
  const verifierDetails = formatRoleFallbackDetails("Verifier (halit)",
    fallbackState.verifier);
  const status: DoctorStatus =
    fallbackState.coordinator.degraded || fallbackState.verifier.degraded
      ? "WARN"
      : "PASS";
  const summary =
    status === "PASS"
      ? "Coordinator and verifier candidates are supported."
      : "Fallback chain engaged for coordinator/verifier or candidate unsupported.";

  return {
    name: "Agent / fallback awareness",
    status,
    summary,
    details: [...coordinatorDetails, ...verifierDetails],
  };
}

export function runDoctor(options?: DoctorOptions): DoctorReport {
  const projectDirectory = options?.projectDirectory ?? process.cwd();
  const loadOptions: LoadHarnessConfigOptions = {
    userConfigPath: options?.userConfigPath,
    projectConfigPath: options?.projectConfigPath,
  };
  const resolved = loadResolvedHarnessConfig(projectDirectory, loadOptions);
  const configDir = options?.configDir ?? getConfigDir();
  const paths = getConfigPaths(configDir);
  const mainConfig = detectMainConfigPath(paths);
  const checks: DoctorCheck[] = [
    checkConfig(resolved),
    checkInstallArtifacts(paths, mainConfig.path),
    checkManagedPlugins(paths, mainConfig.path),
    checkAgentFallback(resolved),
  ];
  const overallStatus = checks.reduce<DoctorStatus>(
    (current, next) => mergeStatus(current, next.status),
    "PASS",
  );
  return {
    overallStatus,
    checks,
    metadata: {
      configDir,
      projectDirectory,
      mainConfigPath: mainConfig.path,
      schemaVersion: resolved.schemaVersion,
      checkedAt: new Date().toISOString(),
    },
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(
    `Doctor report — overall status: ${report.overallStatus} (schema ${report.metadata.schemaVersion})`,
  );
  lines.push(`Config directory: ${report.metadata.configDir}`);
  lines.push(`Main opencode config: ${report.metadata.mainConfigPath}`);
  lines.push("\nChecks:");

  for (const check of report.checks) {
    lines.push(`\n${check.name} [${check.status}]`);
    lines.push(`Summary: ${check.summary}`);
    for (const detail of check.details) {
      lines.push(`- ${detail}`);
    }
  }

  return lines.join("\n");
}

export function determineDoctorExitCode(
  report: DoctorReport,
  strict: boolean,
): number {
  if (strict) {
    return report.overallStatus === "PASS" ? 0 : 1;
  }
  return report.overallStatus === "FAIL" ? 1 : 0;
}
