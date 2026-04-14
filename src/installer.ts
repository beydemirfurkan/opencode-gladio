import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parse } from "jsonc-parser";
import { spawn } from "node:child_process";
import { SAMPLE_PROJECT_CONFIG } from "./config";

type JsonRecord = Record<string, unknown>;

export const MANAGED_PACKAGE_NAMES = ["opencode-gladio"] as const;

export function getConfigDir(): string {
  const envDir = process.env.OPENCODE_CONFIG_DIR?.trim();
  if (envDir) return resolve(envDir);
  return join(homedir(), ".config", "opencode");
}

export function getConfigPaths(configDir: string) {
  return {
    configDir,
    configJson: join(configDir, "opencode.json"),
    configJsonc: join(configDir, "opencode.jsonc"),
    packageJson: join(configDir, "package.json"),
    harnessConfig: join(configDir, "opencode-gladio.jsonc"),
    vendorDir: join(configDir, "vendor", "opencode-background-agents-local"),
  };
}

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function pluginEntryForPath(path: string): string {
  return `file://${path}`;
}

export function detectMainConfigPath(paths: ReturnType<typeof getConfigPaths>): {
  path: string;
  format: "json" | "jsonc";
} {
  if (existsSync(paths.configJson)) return { path: paths.configJson, format: "json" };
  if (existsSync(paths.configJsonc)) return { path: paths.configJsonc, format: "jsonc" };
  return { path: paths.configJson, format: "json" };
}

export function readJsonLike(filePath: string): JsonRecord {
  if (!existsSync(filePath)) return {};
  const raw = readFileSync(filePath, "utf8");
  if (!raw.trim()) return {};
  const parsed = parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as JsonRecord;
}

function backupFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  copyFileSync(filePath, `${filePath}.bak.${Date.now()}`);
}

function writeJson(filePath: string, value: JsonRecord): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function mergePluginList(existing: unknown): string[] {
  const selfEntry = pluginEntryForPath(packageRoot());
  const current = Array.isArray(existing)
    ? existing.filter((item): item is string => typeof item === "string")
    : [];
  const retained = current.filter((item) => item !== selfEntry && item !== "opencode-gladio");
  return [selfEntry, ...retained];
}

export function buildManagedPluginEntries(_vendorDir?: string): string[] {
  return [pluginEntryForPath(packageRoot())];
}

function removeHarnessPluginList(existing: unknown): string[] | undefined {
  const selfEntry = pluginEntryForPath(packageRoot());
  const current = Array.isArray(existing)
    ? existing.filter((item): item is string => typeof item === "string")
    : [];
  const retained = current.filter((item) => item !== selfEntry && item !== "opencode-gladio");
  return retained.length > 0 ? retained : undefined;
}

function ensureDefaultAgent(config: JsonRecord): void {
  if (config.default_agent === undefined) config.default_agent = "polat";
}

function writeHarnessConfig(filePath: string): void {
  if (existsSync(filePath)) return;
  writeFileSync(filePath, `${SAMPLE_PROJECT_CONFIG}\n`, "utf8");
}

function updateConfig(paths: ReturnType<typeof getConfigPaths>): string {
  const detected = detectMainConfigPath(paths);
  const config = readJsonLike(detected.path);
  backupFile(detected.path);
  config.$schema = config.$schema ?? "https://opencode.ai/config.json";
  config.plugin = mergePluginList(config.plugin);
  ensureDefaultAgent(config);
  writeJson(detected.path, config);
  return detected.path;
}

function updatePackageJson(paths: ReturnType<typeof getConfigPaths>): string {
  const pkg = readJsonLike(paths.packageJson);
  backupFile(paths.packageJson);
  const dependencies =
    pkg.dependencies && typeof pkg.dependencies === "object" && !Array.isArray(pkg.dependencies)
      ? { ...(pkg.dependencies as Record<string, string>) }
      : {};
  dependencies["opencode-gladio"] = existsSync(join(packageRoot(), ".git"))
    ? `file:${packageRoot()}`
    : "latest";
  pkg.dependencies = dependencies;
  writeJson(paths.packageJson, pkg);
  return paths.packageJson;
}

async function runBunInstall(configDir: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("bun", ["install"], { cwd: configDir, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) return resolvePromise();
      rejectPromise(new Error(`bun install failed with exit code ${code ?? -1}`));
    });
  });
}

async function ensureInstalledHarnessBuild(configDir: string): Promise<void> {
  const packageDir = join(configDir, "node_modules", "opencode-gladio");
  const builtEntry = join(packageDir, "dist", "index.js");
  const sourceEntry = join(packageDir, "src", "index.ts");
  if (existsSync(builtEntry) || !existsSync(sourceEntry)) return;

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("bun", ["run", "build"], { cwd: packageDir, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) return resolvePromise();
      rejectPromise(new Error(`bun run build failed with exit code ${code ?? -1}`));
    });
  });
}

export async function installHarness(_options?: { fresh?: boolean }): Promise<{
  configPath: string;
  packageJsonPath: string;
  harnessConfigPath: string;
}> {
  const configDir = getConfigDir();
  const paths = getConfigPaths(configDir);
  ensureDir(configDir);
  writeHarnessConfig(paths.harnessConfig);
  const configPath = updateConfig(paths);
  const packageJsonPath = updatePackageJson(paths);
  await runBunInstall(configDir);
  await ensureInstalledHarnessBuild(configDir);
  return { configPath, packageJsonPath, harnessConfigPath: paths.harnessConfig };
}

export async function uninstallHarness(): Promise<{
  configPath: string;
  packageJsonPath: string;
  preservedPaths: string[];
}> {
  const configDir = getConfigDir();
  const paths = getConfigPaths(configDir);
  const detected = detectMainConfigPath(paths);

  if (existsSync(detected.path)) {
    const config = readJsonLike(detected.path);
    backupFile(detected.path);
    const nextPlugin = removeHarnessPluginList(config.plugin);
    if (nextPlugin) config.plugin = nextPlugin;
    else delete config.plugin;
    writeJson(detected.path, config);
  }

  if (existsSync(paths.packageJson)) {
    const pkg = readJsonLike(paths.packageJson);
    const currentDependencies =
      pkg.dependencies && typeof pkg.dependencies === "object" && !Array.isArray(pkg.dependencies)
        ? { ...(pkg.dependencies as Record<string, string>) }
        : undefined;
    if (currentDependencies) {
      backupFile(paths.packageJson);
      delete currentDependencies["opencode-gladio"];
      if (Object.keys(currentDependencies).length > 0) pkg.dependencies = currentDependencies;
      else delete pkg.dependencies;
      writeJson(paths.packageJson, pkg);
      await runBunInstall(configDir);
    }
  }

  return {
    configPath: detected.path,
    packageJsonPath: paths.packageJson,
    preservedPaths: [paths.harnessConfig],
  };
}
