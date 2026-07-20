# Foundry integrations

## Compatibility declarations

`module.json` declares minimum Foundry `12`, verified `14`, and maximum `14`. The runtime includes explicit V12/V13/V14 shims and selects implementation from `game.version`/release data. V14 uses ApplicationV2, `foundry.applications.api.DialogV2`, V14 context-menu item shapes, V14 chat message mode names, `firstLevel` scene background data, and `_loc` localization compatibility. V13 uses the newer Application/Handlebars/FilePicker/ContextMenu locations. V12 retains legacy globals.

The package has not been runtime-tested by this inspection. “Verified 14” is a manifest claim, not an independently reproduced Foundry test. There is no declared maximum beyond 14, and no v13-specific manifest claim beyond the compatibility code.

## Hooks and integration points

| Hook | Integration |
|---|---|
| `init` | Version shim, settings, template preload, API exposure, socket, custom JournalEntryPage model/sheet, helper registration. |
| `ready` | Connectivity probe, model initialization, editor hooks, onboarding, radial macro. |
| `i18nInit` | Loads extra translation files from world setting. |
| `setup` | Resets experimental feature state. |
| Chat hooks | `/c8` direct chat, chat button, chat history, render-time controls. |
| ProseMirror/journal hooks | AI text/image/translation/narration actions and narration playback. |
| Actor/item/journal/document sheet hooks | Header controls, generator entry points, image application, TTS/token controls. |
| Scene hooks | Scene controls/config, image/map generation, scene background application, wall detection. |
| Token hooks | Token HUD voice controls and speaking-token playback. |
| Playlist hooks | Song/TTS UI and generated audio. |
| Compendium/directory hooks | Bulk translation and pack actions. |
| Browser hook | Gallery rendering and pack browser integration. |

## Documents and updates

The code visibly targets Actor, Item, JournalEntry, JournalEntryPage, RollTable, Tile, Scene, Token, Playlist, Macro, compendium documents, and chat messages. It uses Foundry document APIs (`update`, `create`, `setFlag`, `getFlag`, `FilePicker`, `fromUuid`, compendium collections) and application context rather than direct internal state mutation in the inspected paths. The safe fork should preserve the existing preview-first flow and add explicit permission/ownership checks around any newly local provider result application.

## Files and storage

The module registers folder settings and uses `FilePicker`/Foundry upload operations. Defaults point under the module's `storage` directory for actors, items, tiles, scenes, songs, and speech. Auto-downscale settings reduce saved images. Because browser JavaScript cannot safely write arbitrary Unraid paths, the fork must retain these Foundry-supported APIs and allow S3/FilePicker sources.

## Socket and queue

The manifest sets `socket: true`; startup calls a socket connection routine. The queue is persisted in world settings and guarded by a browser distributed lock. Socket payloads must never contain provider API keys. During the fork, only document/result notifications and queue coordination should use sockets; provider requests remain in the initiating client unless the existing Foundry permission model requires GM execution.

## External module integration

VTTA-Tokenizer is an optional integration for automatic token framing. The system definition files provide data-driven support for many game systems rather than hard-coding one system. No external npm dependency manifest is included, so all runtime libraries used by the bundle are either Foundry globals or bundled code.

## Compatibility risks to test

- ApplicationV2 render/part APIs and context-menu item shapes differ between 13 and 14.
- JournalEntryPage custom data-model registration and sheet registration are version-sensitive.
- Scene background storage changed in v14 and is handled by the shim, but every generated-scene update path needs manual verification.
- `DocumentSheetConfig` and FilePicker locations differ by version.
- ProseMirror menu APIs and journal page render hooks are sensitive to Foundry point releases.
- The inherited ProseMirror generation actions referenced the legacy `schema.nodes.div` node. Foundry v14 journal schemas use paragraph blocks, so BoobaStudio 2.2.12 preserves the old node when available and falls back to `schema.nodes.paragraph`.
- The manifest's `maximum: 14` should remain until a real v14 test world passes; do not claim v13/v14 support solely from static shims.
