import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import {
  MANAGED_PLUGIN_ENTRY,
  buildManagedPluginEntries,
  normalizeManagedPluginList,
  removeManagedPluginList,
} from "../installer";

describe("installer managed plugin helpers", () => {
  const configDir = join("C:\\Users", "tester", ".config", "opencode");
  const installedFileEntry = `file://${join(configDir, "node_modules", MANAGED_PLUGIN_ENTRY)}`;

  it("prefers the package entry when normalizing package-name plugins", () => {
    expect(
      normalizeManagedPluginList([MANAGED_PLUGIN_ENTRY, "@example/other-plugin"], configDir),
    ).toEqual([MANAGED_PLUGIN_ENTRY, "@example/other-plugin"]);
  });

  it("migrates installed file-path plugins to the package entry", () => {
    expect(
      normalizeManagedPluginList([installedFileEntry, "@example/other-plugin"], configDir),
    ).toEqual([MANAGED_PLUGIN_ENTRY, "@example/other-plugin"]);
  });

  it("removes both package-name and file-path managed entries", () => {
    expect(removeManagedPluginList([MANAGED_PLUGIN_ENTRY, installedFileEntry, "@example/other-plugin"], configDir)).toEqual([
      "@example/other-plugin",
    ]);
  });

  it("publishes the package entry as the managed plugin target", () => {
    expect(buildManagedPluginEntries()).toEqual([MANAGED_PLUGIN_ENTRY]);
  });
});
