import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "esnext",
    outDir: "dist",
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: false,
    minify: false,
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: false,
    minify: false,
  },
]);
