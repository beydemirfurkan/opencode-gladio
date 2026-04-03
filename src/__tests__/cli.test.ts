import { describe, expect, it } from "bun:test";
import { collectOptionArgs } from "../cli";

describe("collectOptionArgs", () => {
  it("keeps rest args when no standalone option arg exists", () => {
    expect(collectOptionArgs(undefined, ["--json"])).toEqual(["--json"]);
  });

  it("includes a first flag-like arg for top-level commands", () => {
    expect(collectOptionArgs("--json", [])).toEqual(["--json"]);
    expect(collectOptionArgs("--json", ["--strict"])).toEqual([
      "--json",
      "--strict",
    ]);
  });

  it("does not duplicate subcommand args that are not flags", () => {
    expect(collectOptionArgs("show", ["--json", "--sources"])).toEqual([
      "--json",
      "--sources",
    ]);
  });
});
