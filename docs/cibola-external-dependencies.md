# External dependency map

## Runtime and package dependencies

| Dependency | Calls/uses | Required? | Auth | Replaceability |
|---|---|---|---|---|
| Foundry VTT globals | All applications, documents, hooks, settings, file uploads, canvas, ProseMirror | Yes | Foundry session/permissions | Must remain native; compatibility shim already exists. |
| Cibola API (`app.cibola.world`) | Compatibility `AuthService`, `ApiConfigService`, hosted text/image/TTS/song/translation/thread/gallery/vector/pack/queue methods | Optional; only required by unconfigured hosted fallback paths | Legacy client setting, normalized as bearer/token header | Local mode bypasses it for text, image, audio, threads, vectors, and local gallery operations. |
| OpenAI REST | `OpenAIClientService` direct Responses and Images endpoints | Optional today; direct client-only mode | Client-scoped `openaiApiKey` | Directly usable, subject to browser CORS and key exposure. |
| ElevenLabs | Direct TTS and local voice-catalog-compatible UI | Optional | Client-scoped ElevenLabs key and configurable base URL | Implemented directly; voice catalog is user-configured locally. |
| Suno CDN | Plays hosted song URLs from `cdn1.suno.ai` | Optional hosted fallback | URL returned by hosted service | Local Replicate song results use their returned audio URL instead. |
| OpenCV.js | `WallDetectionApp` and worker | Bundled, local | None | Keep bundled; no remote dependency. |
| VTTA-Tokenizer | Token-horde automatic ring path | Optional module | Foundry module integration | Keep optional and detect module availability. |
| Foundry FilePicker/File API | Generated files, folders, uploads | Required for durable assets | Foundry permissions | Keep; never write arbitrary Unraid paths from browser code. |

## Authentication/account/licensing findings

The settings UI and localization explicitly describe Cibola API keys, Patreon connection, account creation, API validation, credits, subscription-only models, and hosted usage. `AuthService` also owns the `alive` health/credits payload and feature/model configuration. This means authentication is not a thin login screen: it initializes model availability, access checks, queue operation eligibility, and hosted request headers.

BoobaStudio local mode extends the original direct-client path. A client-scoped provider setting enables local text, image, TTS, song, thread-chat, vector-library, and browser-local gallery paths while preserving the original façade and hosted fallback behavior when local mode is disabled. AI document translation and community-pack/public-gallery infrastructure remain intentionally out of scope.

## CORS and key exposure

The module runs in the Foundry browser client. API keys in client-scoped Foundry settings are readable by other modules and by users with access to that client profile; the existing localization warns about this. They are not sent through Foundry sockets in the observed code. A future provider setting should use client scope, avoid exports and logs, and clearly disclose browser-side exposure. Direct providers must provide CORS-compatible endpoints; otherwise the UI should distinguish CORS/network errors and support a user-configured compatible endpoint without introducing a new BoobaStudio server.

## Telemetry

The required search terms found no clear Sentry, Segment, PostHog, Mixpanel, analytics, or telemetry endpoint in the compiled bundle. The hosted API necessarily receives prompts, generated-content requests, account/API-key authorization, usage/credit activity, and likely request metadata, but an independent analytics beacon was not identified. Local mode skips hosted health/config initialization when a provider is configured; treat the absence of a separate beacon as “not found,” not proof of absence.
