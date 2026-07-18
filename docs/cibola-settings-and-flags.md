# Settings, flags, and persistence inventory

All observed module settings use the `cibola8` namespace. This is the principal migration risk when changing the module ID.

## Registered settings

| Key | Scope | Type/default | Purpose |
|---|---|---|---|
| `systemSettings` | world | object / `{}` | Per-system configuration and dictionaries. |
| `apiConfigCache` | world | object / `null` | Cached hosted model/feature configuration, written by GM. |
| `chatButton` | client | boolean / `true` | Sidebar chat button. |
| `translationData` | world | object / `{files:[]}` | Additional translation files and active language metadata. |
| `permanentQueue` | world | object / `{items:[]}` | Long-running queued requests, serialized for resume. |
| `radialMenuButtons` | world | object / `{buttons:[]}` | Radial menu definitions. |
| `embeddedDocumentsQueue` | world | object / `{items:[]}` | Embedded document translation/update queue. |
| `apikey` | client | string / empty | Cibola API token; current hosted auth credential. |
| `clientOnlyMode` | client | boolean / `false` | Session-confirmed direct OpenAI mode setting. |
| `openaiApiKey` | client | string / empty | Local OpenAI key for client-only mode. |
| `onboardingSeen` | client | boolean / `false` | Welcome screen state. |
| `radialMacroInstalled` | client | boolean / `false` | Auto-created macro state. |
| `favoriteVoices` | client | array / `[]` | Voice favorites. |
| `max_c8_history` | world | number / `10`, range 0–30 | `/c8` local history length. |
| `wallDetection.maxWalls` | world | number / implementation default, 100–20,000 | Confirmation threshold for wall creation. |
| `${type}Path` | world | folder path under `modules/cibola8/storage/${type}` | Actor/Item/Tile/Scene/Song/Speech generated-file folders. |
| `${type}AutoDownscale` | world | string / empty | Actor/Item image downscale choices. |

The compiled code also reads `chatModel`; its registration is not visible in the extracted registration list and may be declared through a configuration helper or legacy path. This should be confirmed before migration.

## Document flags

- `cibola8.voice.samples` and `cibola8.voice.config` are used on token/actor-related documents and are updated through Foundry `getFlag`/`setFlag`.
- Macro identification uses `flags.cibola8.radialMenu === true`.
- The custom document type is `cibola8.threadgpt` in `JournalEntryPage` configuration and localization.
- Generated asset metadata and hosted prediction identifiers are likely present in result objects and document source, but no single universal flag schema was proven from the minified bundle. Do not assume or delete unknown flags during rebranding.

## Local browser persistence

`DirectChat` saves `/c8` history in `localStorage` under `cibola8-c8-${game.system.id}-${game.world.id}`. The distributed queue lock uses a `cibola8_lock_*` key. A namespace migration should read old keys, copy them to the new ID, and leave the originals intact.

## Migration requirements

The rebrand must not simply replace every `cibola8` string. The recommended compatibility layer is:

1. Centralize `PROJECT_ID = "BoobaStudio"` and `LEGACY_ID = "cibola8"`.
2. Register new settings under the new ID while reading legacy values on first run.
3. Copy, never delete, legacy settings, localStorage history, macro flags, voice flags, and thread type data.
4. Keep a world/client migration marker under the new namespace.
5. Keep the old namespace readable for at least one release so existing worlds and macros continue to function.
6. Update generated default paths only for new installs; retain existing configured paths.

API keys must remain client-scoped, must not enter sockets/document flags/exports/logs, and must not be committed. The existing hosted token is sensitive even though Foundry settings are not a secure secret store.
