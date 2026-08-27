# Project Architectural Rules & Guidelines

## Core Principles

- **Source of Truth**: All source code lives strictly inside `src/`.
- **GENERATED FILES**: NEVER edit files inside `dist/` directly. All changes in `dist/` will be overwritten by the bundler.
- **Build Enforcement**: Always run `npm run build` after editing source files in `src/` to verify bundling and check for compilation errors.

## Common Commands

- **Build**: `npm run build`
- **Watch/Dev**: `npm run dev`
- **Gate**: `npm run check` — lint, build, test, and `verify-dist.js` in one shot.

## Verification Invariant (MANDATORY)

Never end a turn with "I made the changes, please test." Run `npm run check`
before opening a PR and report the result as counts, not output. It is the only
command that proves `dist/` matches `src/`.

## PR Workflow

Feature branch, never commit to `main`. **This repo uses `main`**.
Open the PR as a draft against `main`. Use the `finalize` skill as the framework for PR draft, merge, and closeout.

## Codebase Architecture

- Entry Point: `src/main.js`
- Target Output: `dist/sctoolkit.user.js`
- Tooling: esbuild (bundled via Node.js scripts)

## Agent Rules

1. Before proposing code changes, inspect and edit files ONLY under `src/`.
2. Do not attempt to modify `dist/*.js` or `dist/*.user.js`.
3. After completing code modifications in `src/`, execute `npm run build` using terminal execution to validate the build.
