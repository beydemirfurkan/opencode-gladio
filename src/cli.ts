import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SAMPLE_PROJECT_CONFIG,
  buildConfigShowJson,
  formatConfigShowText,
  loadResolvedHarnessConfig,
} from "./config";
import { installHarness, uninstallHarness } from "./installer";
import {
  determineDoctorExitCode,
  formatDoctorReport,
  runDoctor,
} from "./doctor";
import { MemoryStore, resolveMemoryConfig } from "./memory";

type MemoryCommandOptions = {
  json?: boolean;
};

function printHelp(): void {
  console.log(`opencode-gladio

Commands:
  init [directory]       Create .opencode/opencode-gladio.jsonc
  config show [--json] [--sources]
                         Show the resolved harness config
  doctor [--json] [--strict]
                         Show health report for the harness and install artifacts
  install                Install plugin stack into the active OpenCode config
  fresh-install          Delete non-config files, then reinstall the stack
  uninstall              Remove harness-managed wiring and keep user config files
  memory show [--json]   Show persisted Gladio memory for this project
  memory forget <id>     Delete one saved learning by id
  memory reset           Delete all saved learnings for this project
  print-config           Print the snippet to add into opencode.json
`);
}

function initProject(directory?: string): void {
  const targetRoot = resolve(directory ?? process.cwd());
  const opencodeDir = join(targetRoot, ".opencode");
  const configPath = join(opencodeDir, "opencode-gladio.jsonc");

  if (!existsSync(opencodeDir)) {
    mkdirSync(opencodeDir, { recursive: true });
  }

  if (existsSync(configPath)) {
    console.log(`Already exists: ${configPath}`);
    return;
  }

  writeFileSync(configPath, `${SAMPLE_PROJECT_CONFIG}\n`, "utf8");
  console.log(`Created ${configPath}`);
}

function printConfig(): void {
  console.log(`{
  "plugin": [
    "opencode-gladio"
  ],
  "default_agent": "polat"
}

Run \`npx opencode-gladio install\` or \`bunx opencode-gladio install\` for automatic setup.`);
}

function showConfig(options?: { json?: boolean; sources?: boolean }): void {
  const resolved = loadResolvedHarnessConfig(process.cwd());
  if (options?.json) {
    const payload = buildConfigShowJson(resolved, {
      includeSources: options.sources,
    });
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(formatConfigShowText(resolved, {
    includeSources: options?.sources,
  }));
}

export function createCliMemoryStore(projectDirectory: string = process.cwd()): MemoryStore {
  const resolved = loadResolvedHarnessConfig(projectDirectory);
  return new MemoryStore(projectDirectory, resolveMemoryConfig(resolved.effectiveConfig));
}

export function formatMemoryShowText(memory: MemoryStore): string {
  const context = memory.loadContext();
  const pipeline = memory.loadPipelineState();
  const project = memory.loadProjectFacts();

  const lines: string[] = [];
  lines.push(`Memory directory: ${memory.getDirectory()}`);
  lines.push(`Learnings: ${context.learnings.length}`);

  if (pipeline.last_session) {
    lines.push(
      `Last session: ${pipeline.last_session.status} | phase=${pipeline.last_session.phase} | tier=${pipeline.last_session.tier}`,
    );
  } else {
    lines.push("Last session: none");
  }

  lines.push(
    `Project facts: packageManager=${project.facts.package_manager}, languages=${project.facts.languages.join(", ") || "none"}, frameworks=${project.facts.frameworks.join(", ") || "none"}`,
  );

  if (context.learnings.length > 0) {
    lines.push("Learnings:");
    for (const learning of context.learnings) {
      lines.push(
        `- ${learning.id} [${learning.category}] conf=${learning.confidence} ${learning.content}`,
      );
    }
  }

  return lines.join("\n");
}

function showMemory(options?: MemoryCommandOptions): void {
  const memory = createCliMemoryStore();

  if (!memory.isEnabled()) {
    console.log("Gladio memory is disabled for this project.");
    return;
  }

  if (options?.json) {
    console.log(
      JSON.stringify(
        {
          directory: memory.getDirectory(),
          context: memory.loadContext(),
          pipeline: memory.loadPipelineState(),
          project: memory.loadProjectFacts(),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(formatMemoryShowText(memory));
}

function forgetMemory(id: string | undefined): void {
  if (!id) {
    console.error("Missing learning id. Usage: opencode-gladio memory forget <id>");
    process.exitCode = 1;
    return;
  }

  const memory = createCliMemoryStore();
  if (!memory.isEnabled()) {
    console.log("Gladio memory is disabled for this project.");
    return;
  }

  const removed = memory.removeLearning(id);
  if (!removed) {
    console.error(`Learning not found: ${id}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Removed learning ${id}`);
}

function resetMemory(): void {
  const memory = createCliMemoryStore();
  if (!memory.isEnabled()) {
    console.log("Gladio memory is disabled for this project.");
    return;
  }

  const deleted = memory.clearLearnings();
  console.log(`Cleared ${deleted} learning${deleted === 1 ? "" : "s"}.`);
}

export function collectOptionArgs(
  arg: string | undefined,
  restArgs: string[],
): string[] {
  if (!arg) {
    return restArgs;
  }

  return arg.startsWith("--") ? [arg, ...restArgs] : restArgs;
}

export function main(argv: string[]): void {
  const fresh = argv.includes("--fresh");
  const args = argv.filter((value) => value !== "--fresh");
  const [command, arg, ...restArgs] = args;

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    printHelp();
    return;
  }

  if (command === "init") {
    initProject(arg);
    return;
  }

  if (command === "config" && arg === "show") {
    const json = restArgs.includes("--json");
    const sources = restArgs.includes("--sources");
    showConfig({ json, sources });
    return;
  }

  if (command === "doctor") {
    const optionArgs = collectOptionArgs(arg, restArgs);
    const json = optionArgs.includes("--json");
    const strict = optionArgs.includes("--strict");
    const report = runDoctor();
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatDoctorReport(report));
    }
    const exitCode = determineDoctorExitCode(report, strict);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
    return;
  }

  if (command === "memory" || command === "context") {
    const subcommand = arg;
    const optionArgs = collectOptionArgs(undefined, restArgs);

    if (subcommand === "show") {
      showMemory({ json: optionArgs.includes("--json") });
      return;
    }

    if (subcommand === "forget") {
      forgetMemory(restArgs[0]);
      return;
    }

    if (subcommand === "reset") {
      resetMemory();
      return;
    }
  }

  if (command === "install") {
    installHarness({ fresh })
      .then((result) => {
        console.log(`Installed into ${result.configPath}`);
        console.log(`Updated package manifest ${result.packageJsonPath}`);
        console.log(`Harness config ready at ${result.harnessConfigPath}`);
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    return;
  }

  if (command === "fresh-install") {
    installHarness({ fresh: true })
      .then((result) => {
        console.log(`Fresh-installed into ${result.configPath}`);
        console.log(`Updated package manifest ${result.packageJsonPath}`);
        console.log(`Harness config ready at ${result.harnessConfigPath}`);
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    return;
  }

  if (command === "print-config") {
    printConfig();
    return;
  }

  if (command === "uninstall") {
    uninstallHarness()
      .then((result) => {
        console.log(`Uninstalled harness wiring from ${result.configPath}`);
        console.log(`Updated package manifest ${result.packageJsonPath}`);
        console.log(
          `Preserved user files: ${result.preservedPaths.join(", ")}`,
        );
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    return;
  }

  printHelp();
}

function isDirectExecution(): boolean {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }

  return resolve(entryPath) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  main(process.argv.slice(2));
}
