# Cibola 8 baseline architecture

## Scope and evidence

This report describes the supplied package at `/home/booba/cibola8`, copied unchanged into the BoobaStudio baseline commit `b33f44e` and tag `cibola-baseline`. Evidence is the manifest, the single compiled entry point, templates, SCSS, localization, the OpenCV bundle, and the Journal compendium. The JavaScript bundle has 225 physical lines, most of them minified; names recovered below are the names preserved by the bundler or exposed through exports. There is no original JavaScript/TypeScript source tree.

## Package structure

| Area | Contents | Role |
|---|---|---|
| `module.json` | Foundry manifest | Declares `bundle/modules/init.js`, compiled CSS, four languages, one Journal pack, socket support, persistent storage, and `cibola8.threadgpt`. |
| `bundle/modules/init.js` | 514,042-byte compiled bundle | All runtime services, applications, hooks, providers, Foundry shims, queue logic, and UI controllers. |
| `bundle/systemdefines/*.js` | 32 small system definition files | Per-system field/prompt definitions for D&D, PF2e, WFRP, SWADE, etc.; loaded as data/configuration by the runtime. |
| `bundle/lib/opencv/opencv.js` | 10.9 MB OpenCV.js | Local wall-detection image processing, including worker/offscreen-canvas paths. |
| `templates/` | 100+ Handlebars templates | Applications for generation, image tools, gallery, packs, threads, translation, names, songs/TTS, vectors, queue, token tools, onboarding, and settings. |
| `styles/scss/` and `styles/css/` | SCSS sources plus compiled CSS/map | Shared Cibola component styles, gallery, thread, onboarding, queue, radial menu, names, and system fixes. |
| `lang/` | `en`, `de`, `fr`, `es` | Localization under the `cibola8` namespace. |
| `packs/documentation/` | LevelDB JournalEntry pack | Embedded documentation; not a source database or application database. |
| `storage/` | Empty package directory | Default target prefix for generated files; actual writes go through Foundry file APIs. |

## Initialization flow

1. Foundry loads `bundle/modules/init.js` from the manifest.
2. `init` installs the version shim (`FoundryV12Shims`, `FoundryV13Shims`, or `FoundryV14Shims`), initializes configuration/model metadata, preloads selected templates, registers settings, installs service hooks, connects the module socket, exposes `game.modules.get("cibola8").api`, and registers the `JournalEntryPage` data model and sheet.
3. `i18nInit` loads optional translation files from the `translationData` world setting.
4. `ready` probes Cibola connectivity, initializes model data, installs ProseMirror integrations, and runs onboarding plus radial-macro setup.
5. Runtime applications are opened from sidebar controls, document header buttons, scene controls, context menus, editor controls, token HUD controls, the radial menu, and the `/c8` chat command.

The public API currently exposes `DirectChat`, `menu`, `experimentalFeatures`, and `RadialWidget`.

## Major services and applications

The bundle preserves these meaningful service/application names:

- `AuthService`: API key normalization, bearer/token request construction, connectivity/health, hosted URL routing, API error handling, and operation wrappers.
- `ApiConfigService`: fetches and validates hosted model/feature configuration and caches it in a world setting.
- `OpenAIClientService` and `ClientOnlyModeGate`: direct browser-side OpenAI Responses and Images calls, with per-session confirmation.
- `TextGenerationService`: query, enhancement, chat, edit, and prompt-oriented text operations.
- The exported façade around these services exposes `query`, `chat`, `enhance`, `genImage`, `translate`, `generateTTS`, `generateSong`, vector operations, gallery operations, and hosted prediction/pack operations.
- `QueueManager`, `QueueItem`, `EmbeddedDocumentsQueue`, `QueueMonitor`, `QueueViewer`, and `TranslationCompletion`: persistent long-running jobs and translation resumption.
- `GptThreadSheet` / `GptThreadSheetV2`: custom JournalEntryPage thread sheet for Foundry 12/13 and 14 paths.
- `AiBothGen`: central image generation/editor UI; its templates contain prompt, gallery, canvas, crop, inpaint/selection, upscale, remove-background, image application, and translation controls.
- `BrowserForm`: gallery/browser and public/pack browsing.
- `SceneRandomGen`, `CibolaNames`, `TokenHorde`, `TokenHordePack`, `TokenSpeaks`, `AiMusicGen`, `TTSJournalApp`, and `TTSTokenSpeaksApp`.
- `WallDetectionApp`: local OpenCV worker/application with preview, presets, selection, erasure, brush editing, wall type assignment, and Foundry wall creation.
- `ConfigureSystem`, `LocalizerForm`, pack applications, radial menu applications, and onboarding/configuration dialogs.

Many other classes are minifier aliases. The template paths and static `DEFAULT_OPTIONS`/`PARTS` declarations are the most reliable class-to-UI mapping available without source recovery.

## Foundry integration model

The module uses a compatibility façade instead of a single Foundry generation. It selects ApplicationV2/Handlebars APIs for v14, v13, and v12, normalizes context menus, chat message modes, `FilePicker`, `CompendiumCollection`, `DocumentSheetConfig`, scene background data, and localization. It registers a custom `cibola8.threadgpt` JournalEntryPage model and default sheet.

Foundry hooks include `init`, `ready`, `i18nInit`, `setup`, chat input/log rendering, ProseMirror menu and journal rendering, actor/item/journal/document sheet headers, scene controls/config, token HUD, playlist directory, roll-table config, compendium directory/folder/context actions, browser rendering, and document sheet rendering.

## UI and styling conventions

The existing UI is template-first. Application classes declare static `DEFAULT_OPTIONS` and `PARTS`, render `modules/cibola8/templates/...`, and use `data-action` dispatch. The CSS root and most component classes use `cibola8`, `cibola8-dark-theme`, `cibola8-*`, and icon classes such as `cib8-icon icon-cibola8`. Rebranding should keep class names initially to avoid a broad CSS/template rewrite, while centralizing the new module ID for runtime paths and persistence.

## Persistence and assets

- Foundry settings hold configuration, queue state, translation metadata, radial-menu definitions, API config cache, favorite voices, and client preferences.
- `/c8` chat history is stored in browser `localStorage` under `cibola8-c8-${game.system.id}-${game.world.id}`.
- Thread message history is stored in the JournalEntryPage document's `system.messages` and related custom schema fields.
- Voice samples/configuration use `cibola8` document flags.
- Generated files use configurable Foundry `FilePicker` folder settings for Actor, Item, Tile, Scene, Song, and Speech outputs. The runtime uses Foundry upload APIs rather than arbitrary server paths.
- Gallery/history metadata is primarily hosted prediction data for the Cibola mode; local client-only image results are converted to files and can be saved through the existing image UI.
- The permanent queue is serialized in a world setting and resumed during startup. A browser distributed lock prevents duplicate processing.

## Architectural conclusion

This is a large native module with a centralized hosted-service façade, not a collection of independent providers. The smallest safe fork is to preserve the façade and UI, add a local provider mode behind the existing service method signatures, and migrate namespace-sensitive persistence in place. Rebuilding applications would discard significant existing behavior.
