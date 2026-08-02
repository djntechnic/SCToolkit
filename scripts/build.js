#!/usr/bin/env node
/**
 * Bundle src/main.js into the single distributable userscript.
 *
 * esbuild is invoked through its JS API rather than the CLI so the banner can
 * be composed in-process — the shell-substitution form of `--banner:js` is not
 * portable to PowerShell.
 */
import { build, context } from "esbuild";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBanner } from "../src/meta.js";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("package.json", root)), "utf8"),
);

const isWatch = process.argv.includes("--watch");

/** Custom esbuild plugin to track modified files and build metrics */
const timestampPlugin = {
  name: "timestamp-plugin",
  setup(build) {
    let startTime;
    let modifiedFiles = new Set();
    let isInitialBuild = true;

    // Track files loaded by esbuild during the compilation step
    build.onLoad({ filter: /.*/ }, (args) => {
      if (!isInitialBuild) {
        // Convert absolute path to a clean relative path (e.g., "src/ui/icons.js")
        const relPath = relative(rootPath, args.path).replace(/\\/g, "/");
        modifiedFiles.add(relPath);
      }
    });

    build.onStart(() => {
      startTime = Date.now();
      modifiedFiles.clear();
    });

    build.onEnd((result) => {
      const time = new Date().toLocaleTimeString();
      const duration = Date.now() - startTime;

      if (result.errors.length > 0) {
        console.error(
          `\n[${time}] ❌ Build failed with ${result.errors.length} error(s) (${duration}ms)`,
        );
      } else {
        if (isInitialBuild) {
          console.log(`[${time}]  Initial build complete (${duration}ms)`);
          isInitialBuild = false;
        } else {
          const filesList = Array.from(modifiedFiles);
          const count = filesList.length;

          // Format output based on how many files were modified
          let changeSummary = "No source changes";
          if (count === 1) {
            changeSummary = `1 file changed: ${filesList[0]}`;
          } else if (count > 1) {
            changeSummary = `${count} files changed: [${filesList.slice(0, 3).join(", ")}${count > 3 ? ` +${count - 3} more` : ""}]`;
          }

          console.log(`[${time}]  Rebuilt in ${duration}ms | ${changeSummary}`);
        }
      }
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [fileURLToPath(new URL("src/main.js", root))],
  outfile: fileURLToPath(new URL("dist/sctoolkit.user.js", root)),
  bundle: true,
  format: "iife",
  target: "chrome110",
  charset: "utf8",
  legalComments: "none",
  banner: { js: buildBanner(pkg) },
  logLevel: "silent",
  plugins: [timestampPlugin],
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("⚡ Watching src/ for changes...\n");
} else {
  await build(options);
}
