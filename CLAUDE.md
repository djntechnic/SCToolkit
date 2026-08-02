# Project Architectural Rules & Guidelines

## Core Principles

- **Source of Truth**: All source code lives strictly inside `src/`.
- **GENERATED FILES**: NEVER edit files inside `dist/` directly. All changes in `dist/` will be overwritten by the bundler.
- **Build Enforcement**: Always run `npm run build` after editing source files in `src/` to verify bundling and check for compilation errors.

## Common Commands

- **Build**: `npm run build`
- **Watch/Dev**: `npm run dev`

## Codebase Architecture

- Entry Point: `src/main.js`
- Target Output: `dist/sctoolkit.user.js`
- Tooling: esbuild (bundled via Node.js scripts)

## Agent Rules

1. Before proposing code changes, inspect and edit files ONLY under `src/`.
2. Do not attempt to modify `dist/*.js` or `dist/*.user.js`.
3. After completing code modifications in `src/`, execute `npm run build` using terminal execution to validate the build.
