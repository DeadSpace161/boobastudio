# External dependency map

## Runtime and package dependencies

| Dependency | Calls/uses | Required? | Auth | Replaceability |
|---|---|---|---|---|
| Foundry VTT globals | All applications, documents, hooks, settings, file uploads, canvas, ProseMirror | Yes | Foundry session/permissions | Must remain native; compatibility shim already exists. |
| Cibola API (`app.cibola.world`) | `AuthService`, `ApiConfigService`, text/image/TTS/song/translation/thread/gallery/vector/pack/queue methods | Required by normal hosted mode | Client setting `cibola8.apikey`, normalized as bearer/token header | Primary replacement target: retain façade, substitute provider adapters. |
| OpenAI REST | `OpenAIClientService` direct Responses and Images endpoints | Optional today; direct client-only mode | Client-scoped `openaiApiKey` | Directly usable, subject to browser CORS and key exposure. |
| ElevenLabs | Voice search, voice previews, TTS/music labels and hosted calls | Optional/hosted | Service/API key is mediated by Cibola in current bundle | Direct adapter possible later; existing response/UI fields should be retained. |
| Suno CDN | Plays generated song URLs from `cdn1.suno.ai` | Optional, result playback | URL returned by hosted service | Replace with returned provider URL or Foundry-uploaded asset. |
| OpenCV.js | `WallDetectionApp` and worker | Bundled, local | None | Keep bundled; no remote dependency. |
| VTTA-Tokenizer | Token-horde automatic ring path | Optional module | Foundry module integration | Keep optional and detect module availability. |
| Foundry FilePicker/File API | Generated files, folders, uploads | Required for durable assets | Foundry permissions | Keep; never write arbitrary Unraid paths from browser code. |

## Authentication/account/licensing findings

The settings UI and localization explicitly describe Cibola API keys, Patreon connection, account creation, API validation, credits, subscription-only models, and hosted usage. `AuthService` also owns the `alive` health/credits payload and feature/model configuration. This means authentication is not a thin login screen: it initializes model availability, access checks, queue operation eligibility, and hosted request headers.

The existing direct OpenAI mode is deliberately limited. `clientOnlyMode` plus a client-scoped `openaiApiKey` can enable direct text and text-prompt image generation, and the UI warns that threads, gallery, TTS, translation, and other backend features remain hosted. It is the best evidence-backed seed for the first local provider implementation.

## CORS and key exposure

The module runs in the Foundry browser client. API keys in client-scoped Foundry settings are readable by other modules and by users with access to that client profile; the existing localization warns about this. They are not sent through Foundry sockets in the observed code. A future provider setting should use client scope, avoid exports and logs, and clearly disclose browser-side exposure. Direct providers must provide CORS-compatible endpoints; otherwise the UI should distinguish CORS/network errors and support a user-configured compatible endpoint without introducing a new BoobaStudio server.

## Telemetry

The required search terms found no clear Sentry, Segment, PostHog, Mixpanel, analytics, or telemetry endpoint in the compiled bundle. The hosted API necessarily receives prompts, generated-content requests, account/API-key authorization, usage/credit activity, and likely request metadata, but an independent analytics beacon was not identified. Treat this as “not found,” not proof of absence. Phase 1 should disable hosted health/config calls by default in local mode and audit request wrappers again after source recovery.
