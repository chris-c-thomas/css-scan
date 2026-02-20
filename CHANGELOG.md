# Changelog

## [2.0.0] - 2026-02-19

### Breaking Changes

- `scanCssCoverage()` now returns a `ScanReport` object instead of `CssUsageResult`. Consumers of the programmatic API will need to update their types.
- CSS output header comment format changed from `/* used.css - scanned N pages */` to `/* css-scan report — <url> — N page(s) — <timestamp> */`.

### Added

- **postcss AST-based analysis** — CSS rules are now classified as whole AST nodes instead of raw byte-range slices. This eliminates mid-rule splits and produces guaranteed-valid CSS output.
- **Structured `ScanReport` data model** validated at runtime by Zod schemas, providing a canonical contract between the analyzer and all output reporters.
- **JSON output format** — Use `--format json` or `--json` to export a detailed `css-scan-report.json` with per-rule classification, per-stylesheet analysis, and summary statistics.
- **Rule count metrics** in the terminal UI — the SUCCESS screen now displays used/unused rule counts alongside byte counts.
- **`--format, -f` CLI flag** for selecting output format (`css` or `json`).
- **`--json` CLI flag** as shorthand for `--format json`.
- **Validation script** (`scripts/validate-refactor.mjs`) for verifying output correctness.

### Changed

- **Architecture decomposed** — the monolithic `scanner.ts` has been split into focused modules:
  - `crawler.ts` — BFS page traversal and link discovery (no CSS logic).
  - `collector.ts` — Playwright CSS coverage collection, viewport cycling, and range merging.
  - `analyzer.ts` — postcss AST parsing and rule classification (replaces byte-range slicing).
  - `reporter/` — pluggable output layer (`css.ts`, `json.ts`, `summary.ts`).
  - `scanner.ts` — thin orchestrator that wires the above modules together.
- **Inline style deduplication** now uses content-based SHA-256 hashing instead of visit-count + text-length keys, preventing collisions.
- **Coverage range clamping** — range ends are clamped to text length to handle a known Chromium edge case.
- **Brace-balancing removed** — no longer needed since CSS output comes from `postcss.Root.toString()`.
- **Prettier** is now used purely for formatting consistency, not as a repair mechanism for invalid CSS fragments.

### Fixed

- CSS output files are now guaranteed to be valid, parseable CSS. The old byte-range approach could produce fragments with unbalanced braces or mid-rule splits.
- `@media` and other at-rule blocks containing a mix of used and unused rules are now correctly split — the wrapper appears in both `used.css` and `unused.css` with only the relevant children.
- `@charset`, `@import`, `@font-face`, and `@keyframes` rules are handled explicitly instead of being subject to byte-range slicing artifacts.

### Dependencies

- Added `postcss` — CSS AST parsing, walking, and stringification.
- Added `zod` — runtime schema validation for the `ScanReport` data model.
- Added `cosmiconfig` — config file discovery (installed for future config file support).

## [1.1.0] - 2026-01-12

- Multi-page scanning with `--depth` and `--max-pages` flags.
- BFS crawling across same-origin pages.
- CSS coverage aggregated across multiple pages and three viewports.

## [1.0.0] - 2020-01-12

- Initial release. Single-page CSS coverage scanning with Playwright.
