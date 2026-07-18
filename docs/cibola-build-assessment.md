# Build and source assessment

## Inventory

| Item | Finding | Consequence |
|---|---|---|
| Original JavaScript/TypeScript | Not present | `bundle/modules/init.js` is the only runtime source. |
| JavaScript source map | Not present | Original module boundaries and source names cannot be recovered automatically. |
| Compiled JS | Present, 514,042 bytes, 225 very long lines | Runtime is usable as a preserved baseline but narrow edits are difficult and fragile. |
| SCSS source | Present, ten files | CSS can be maintained from existing sources. |
| CSS source map | Present, sources only; no `sourcesContent` | It points to existing SCSS paths but does not recover missing source. |
| Compiled CSS | Present, 213,743 bytes | Existing styles can remain unchanged during the first phase. |
| Dependency manifest | None found (`package.json`, lockfile, tsconfig, bundler configs absent) | No reproducible JS/CSS build process is included. |
| Build scripts | None found | Do not assume `npm build` is possible. |
| Bundled third-party code | OpenCV.js present with README | Local wall detection is self-contained. |
| Foundry pack | LevelDB Journal pack present | Documentation pack is distributable data, not a development dependency. |
| Release ZIP | Present at `/home/booba/cibola8.zip` | Archive contains the same extracted package under a `cibola8/` top-level directory. |
| Private packages/env vars | No manifests or source references found | Hosted runtime credentials are settings, not build-time environment variables. |

## Source-recovery decision

Do not manually retype or broadly format the bundle. Preserve the exact compiled baseline and use narrow transformations only after identifying stable text boundaries. Before functional changes, establish a local source-recovery/build approach: either obtain the authorized upstream source/build metadata or create a minimal bundler that can reproduce the current entry point from recovered modules. A hand-maintained replacement bundle would be too risky for this feature surface.

The CSS side is recoverable enough to rebuild from the existing SCSS, but rebranding should not require CSS rebuild until the ID/asset plan is settled.

## Baseline validation performed

- Manifest references match existing `bundle/modules/init.js`, `styles/css/css.css`, language files, asset paths, and Journal pack.
- The ZIP lists 208 package entries and the extracted package contains the same principal resources.
- The package was copied unchanged into BoobaStudio and committed/tagged before documentation work.
- No runtime code was modified in Phase 0.

## Build risks

- Direct edits to one-line minified JavaScript can corrupt syntax or alter unrelated code.
- Path strings embed `modules/cibola8`; ID replacement affects templates, settings, macro commands, OpenCV worker URL, default folders, and document types.
- CSS source map references relative SCSS paths but does not embed source contents.
- The package includes LevelDB lock/log files; they are baseline package data and should not be regenerated casually.
- New generated assets, secrets, release ZIPs, and local storage should remain ignored; the baseline deliberately force-commits the supplied pack files.
