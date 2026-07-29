# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phase 0 scaffolding: public repository, MIT license, `src/` module layout,
  esbuild bundle pipeline, generated userscript banner, `node --test` suite,
  CI and release workflows, issue templates.
- Auto-update support via `@updateURL` / `@downloadURL` against `dist/` on `main`.

### Changed
- Project renamed to **SCToolkit** and relocated to its own repository.
- `@description` reduced to a single sentence; release history now lives in this
  file rather than in the userscript metadata block.

### Removed
- `@grant GM_addStyle` — declared but never used by the script.

## [2.42.0] — prior single-file releases

Versions up to and including 2.42.0 were maintained as a single monolithic
userscript with no changelog and are not published here. The v3.0 line starts
this history.
