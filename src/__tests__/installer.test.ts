import { describe, it, expect } from "bun:test";
import {
  applySafePermissionNormalization,
  ensureDefaultAgent,
  mergePluginList,
  patchBackgroundAgentsSource,
  removeHarnessPluginList,
} from "../installer";

describe("mergePluginList", () => {
  const vendorDir = "/tmp/opencode/vendor";

  it("preserves unrelated plugin entries", () => {
    const existing = [
      "file:///custom/plugin-entry",
      "custom-plugin",
      "@zenobius/opencode-skillful@1.0.0",
    ];

    const result = mergePluginList(existing, vendorDir);

    expect(result).toContain("file:///custom/plugin-entry");
    expect(result).toContain("custom-plugin");
    expect(result).not.toContain("@zenobius/opencode-skillful@1.0.0");
    expect(result).toContain("@zenobius/opencode-skillful@latest");
    expect(result).toContain(`file://${vendorDir}`);
  });
});

describe("removeHarnessPluginList", () => {
  const vendorDir = "/tmp/opencode/vendor";

  it("removes only harness-managed entries", () => {
    const existing = [
      "@zenobius/opencode-skillful@latest",
      "opencode-gladio",
      `file://${vendorDir}`,
      "file:///keep/me",
      "opencode-gladiator",
    ];

    const result = removeHarnessPluginList(existing, vendorDir);

    expect(result).toBeDefined();
    expect(result).toContain("file:///keep/me");
    expect(result).toContain("opencode-gladiator");
    expect(result).not.toContain("@zenobius/opencode-skillful@latest");
    expect(result).not.toContain("opencode-gladio");
    expect(result).not.toContain(`file://${vendorDir}`);
  });
});

describe("ensureDefaultAgent", () => {
  it("does not override an existing default agent", () => {
    const config = { default_agent: "zelda" } as Record<string, unknown>;
    ensureDefaultAgent(config);
    expect(config.default_agent).toBe("zelda");
  });

  it("sets a default agent when missing", () => {
    const config = {} as Record<string, unknown>;
    ensureDefaultAgent(config);
    expect(config.default_agent).toBe("polat");
  });
});

describe("applySafePermissionNormalization", () => {
  it("does not force permission to allow when nothing to normalize", () => {
    const config = {} as Record<string, unknown>;
    applySafePermissionNormalization(config);
    expect(config.permission).toBeUndefined();
  });

  it("normalizes a legacy ruleset without overwriting existing permissions", () => {
    const config = {
      ruleset: "ask",
      permission: "deny",
    } as Record<string, unknown>;

    applySafePermissionNormalization(config);

    expect(config.permission).toBe("deny");
    expect(config.ruleset).toBeUndefined();
  });
});

describe("patchBackgroundAgentsSource", () => {
  it("rewrites unique-names-generator import to a Bun-safe default import", () => {
    const source = [
      'import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator"',
      "const id = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] });",
    ].join("\n");

    const result = patchBackgroundAgentsSource(source);

    expect(result).toContain(
      'import uniqueNamesPkg from "unique-names-generator"',
    );
    expect(result).toContain(
      "const { adjectives, animals, colors, uniqueNamesGenerator } = uniqueNamesPkg",
    );
    expect(result).not.toContain(
      'import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator"',
    );
  });
});
