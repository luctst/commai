import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    cli: "bin/cli.ts",
  },
  outDir: "dist",
  minify: true,
  sourcemap: false,
  deps: {
    neverBundle: ["chalk", "commander"],
  },
});
