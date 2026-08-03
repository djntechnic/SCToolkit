# Project Architectural Rules & Guidelines

## Core Principles

- **Source of Truth**: All source code lives strictly inside `src/`.
- **GENERATED FILES**: NEVER edit files inside `dist/` directly. All changes in `dist/` are automatically overwritten during the bundling process.
- **Build Enforcement**: Always run `npm run build` after editing source files in `src/` to verify bundling and catch compilation or syntax errors early.

## Common Commands

- **Build Project**: `npm run build`
- **Watch/Dev Mode**: `npm run dev`

## Codebase Architecture

- **Entry Point**: `src/main.js`
- **Target Output**: `dist/sctoolkit.user.js`
- **Bundler Tooling**: `esbuild` (managed via custom Node.js build scripts in `scripts/build.js`)

## Gemini / Agent Operating Rules

1. **Strict Directory Isolation**: Inspect and edit files ONLY inside the `src/` directory tree.
2. **Read-Only Distribution Assets**: Never attempt to modify `dist/*.js` or `dist/*.user.js`.
3. **Build Verification Required**: Immediately after completing modifications in `src/`, execute `npm run build` using the terminal tool to validate the build pipeline.
4. **Modularity & Diagnostics**: When adding or refactoring functionality, ensure modular boundaries are maintained across `src/core/`, `src/net/`, `src/data/`, and `src/modules/` with inline diagnostic logging.
