# BoobaStudio current implementation status

This status reflects the locally built package prepared as version **2.2.109**. The public test server remains on the last published 2.2.97 package while the 2.2.109 release awaits repository write access.

## Verified

- Foundry v14 Build 363 loads the module from the normal module installer.
- The existing Cibola application structure, templates, settings, document hooks, image editor, history, gallery, and file handling remain in use.
- Client-scoped provider settings support OpenAI-compatible endpoints, OpenRouter, Ollama, LM Studio, Anthropic, Gemini, ComfyUI, Stability AI, Replicate, OpenAI TTS, and ElevenLabs.
- Existing prose generation can submit a prompt, render a result, insert it into a Journal editor, and persist the JournalEntryPage update.
- The existing direct `/c8` chat path bypasses the hosted account-connectivity check when a local provider is configured; its local response is normalized to the existing chat message object and browser-local history contract.
- The direct chat service’s legacy GPT-only model restriction now applies only to unconfigured client-only mode; configured local providers can use OpenRouter, Ollama, LM Studio, or other compatible model names through the existing chat path.
- Direct `/c8` chat no longer requires the legacy client-only-mode toggle or hosted confirmation gate when a local provider is explicitly configured; the legacy gates remain active for unconfigured sessions.
- Existing AI Thread JournalEntryPage sheets now recognize an explicitly configured local provider for account visibility, messaging controls, and local vector-file upload access; thread messages continue to persist in the existing JournalEntryPage `system.messages` field.
- Local AI Thread replies now preserve `system.thread_id` when the local provider returns no hosted thread ID; hosted thread responses retain the original thread-ID update behavior.
- Personal image packs now use a browser-local pack façade over local gallery IDs, preserving the existing pack create/list/detail/image/update/delete contracts without duplicating image payloads or contacting Cibola.
- Local personal pack detail, image paging, cover-image updates, and generic pack-detail navigation now remain local through the existing pack API methods.
- Token Horde now exposes a local circular-token fallback using browser canvas and Foundry `FilePicker` when VTTA-Tokenizer is not installed; VTTA-Tokenizer remains preferred when available.
- Module JavaScript assets now use release-versioned filenames so Foundry/browser caches cannot retain an older provider façade after a package update.
- The existing image selector now exposes a configured local image model, including arbitrary Replicate model IDs, while the hosted model catalog remains unchanged.
- Local vector files with extractable text can now provide ranked token-overlap context to local text requests through a client setting; this is a lightweight local retrieval fallback, not a hosted embedding index.
- Local provider chat fallback accepts the existing workflow modes used by threads, name generation, and other Cibola chat callers instead of restricting local use to the literal `chat` mode.
- The existing `enhance` façade now routes through the local text provider and preserves its `{result}` callback contract for prompt improvement and document enhancement workflows.
- Local-provider startup now skips the hosted model/config fetch and retains the bundled model defaults; hosted mode continues to use the original remote configuration path.
- Existing scene image generation can preview a result and expose Save, Save As, Apply as Tile, and Download actions.
- Local image generation bypasses the legacy hosted client-only session confirmation only when a local provider is configured; unconfigured sessions retain the original safety gate.
- Existing image-tools description action now routes image data URLs through the configured OpenAI-compatible vision model and returns the original `{status:"done",result}` callback shape; the UI and editor insertion path are unchanged.
- Existing image edit/variation requests that include an input image or mask now route to the configured OpenAI-compatible `/images/edits` endpoint as multipart form data, while ordinary generation continues to use `/images/generations`; data-URL inputs are converted in the browser without a server upload.
- The existing `genVariant` façade now has the same local-provider bridge as `genImage`, preserving the current callback/result shape and routing variants through the configured OpenAI-compatible, Replicate, Stability, or ComfyUI image adapter.
- Existing Scene Upscale payloads that carry the source image in the prompt now normalize that image into the provider input and preserve scale/factor controls for Replicate-compatible upscalers.
- Replicate image workflows now support optional client-scoped input JSON with placeholders for prompt, image, mask, factor, scale, width, and height, allowing model-specific controls without modifying the module.
- Existing image prompt-builder action now routes `{command, amount}` through the local text provider, validates the returned JSON array, and preserves the original prompt-tab population flow.
- Existing narration/TTS generation now routes through the configured OpenAI or ElevenLabs adapter and preserves the existing audio preview, Foundry upload, and playlist flow.
- Local TTS voice-catalog requests no longer contact Cibola; hosted voice search remains unchanged when local mode is disabled.
- Local OpenAI TTS voice-catalog requests now return an offline catalog with search and pagination; ElevenLabs remains empty locally unless a compatible voice catalog is added without contacting a hosted service.
- ElevenLabs users can now provide a client-scoped local voice catalog JSON array, preserving voice selection and search without contacting ElevenLabs voice-list endpoints.
- Existing song generation now supports a client-configured Replicate music model, with configurable model-input JSON and placeholder substitution, while preserving the existing song preview, download, and playlist flow.
- Local song results are indexed in the same browser-local gallery store and returned through the existing `filter:"song"` browser contract.
- Local song cards now play and copy the provider-returned `audio_url`; hosted Suno CDN URLs remain the compatibility fallback for older records.
- Actor sheet integration opens the existing image application with the selected Actor as its source document.
- Generated Actor images can be saved through Foundry file handling and update the Actor image field; no arbitrary server path is written by browser code.
- The automated Foundry v14 probe now exercises that native save path with a temporary Actor: Foundry accepted the upload and the Actor image field updated to the returned module storage path before cleanup.
- The same probe now creates a temporary Scene, opens the existing Scene Image Tools control, saves a generated image through Foundry file handling, verifies `background.src` changed to the returned scene storage path, and deletes the temporary Scene.
- Provider requests and responses are normalized in the existing Cibola-compatible façade. Errors distinguish network/CORS, timeout, invalid key, access denied, rate limit, and generic provider failures.
- Locally configured image generations are persisted in browser-local storage through the existing gallery request/delete façade. The live Foundry browser probe confirmed pagination, record shape, and deletion without a Cibola-hosted request.
- The local gallery façade now returns the existing `pagy.next` shape used by the browser’s infinite-scroll and embedded gallery components.
- Local gallery share and public-toggle actions now return an explicit local-mode limitation instead of reaching Cibola-hosted endpoints.
- Existing gallery pack actions are explicitly disabled in local mode, preventing accidental requests to the hosted community-pack APIs.
- The existing vector-store upload, list, and delete callbacks now have a browser-local persistence path using the same Cibola-compatible response shape. Text-file content is retained locally when it fits the browser storage limit; no external vector index is required for library management.
- Existing scene wall detection remains fully local through the bundled OpenCV.js worker and Foundry wall-document update path; it does not require a provider or Cibola service.
- The visible active UI is rebranded to BoobaStudio; the legacy `cibola8` namespace and persisted data remain available for migration compatibility.
- The onboarding “Web App” action now opens the BoobaStudio repository instead of the former hosted application URL.
- Active configuration and feedback links now point to the BoobaStudio repository, issues, discussions, and releases rather than legacy community destinations.
- Automated checks pass: package validation, provider smoke tests, JavaScript syntax/build, and live Foundry v14 smoke validation. The published 2.2.97 build preserves compatible local gallery metadata, safe local thread persistence, complete local pack operations, configurable local image model selection, and local token framing fallback. The live server reports 2.2.97 active; the live provider harness confirms normalized OpenAI-compatible, native Anthropic, and native Gemini text/query paths, OpenAI and ElevenLabs TTS audio responses, OpenAI-compatible, Replicate, Stability, and ComfyUI image responses, Actor-sheet and Scene-sheet control injection, radial-menu opening, image-generator window opening, temporary Item document lifecycle, local pack lifecycle, and the token fallback factory. All live provider calls use Playwright-intercepted mock requests.
- The 2.2.98 build supplies a safe local model configuration when the hosted image catalog is unavailable, preventing the existing Image Tools prompt workflow from dereferencing a missing model config in local mode.
- The 2.2.99 build extends the same local-catalog safety to the existing TTS window, preventing an unavailable hosted TTS model record from dereferencing `.fields` before the configured local audio provider is called.
- The 2.2.100 build aligns local circular-token uploads with the existing Foundry v14 FilePicker contract and accepts both string and object upload results; the public 2.2.97 probe exposed the previous mismatch, so live token upload verification awaits publication.
- The 2.2.101 build supplies safe empty local model configurations to the existing shared image-field collector, Scene prompt/upscale handlers, and TTS model-change handler. This closes the next local-catalog dereferences beyond the initial Image Tools window-opening fix.
- The 2.2.102 build also adds the configured local image model to the existing Scene model selector, preserving the same provider/model choice across Actor/Image Tools and Scene generation when the hosted model catalog is unavailable.
- The 2.2.103 build keeps local model IDs in the existing image-model preparation path and supplies safe descriptors to advanced image-edit readers, so local generation, editing, inpainting, and variation forms are not filtered out or passed undefined model metadata.
- The 2.2.104 build hardens persistent AI Threads for arbitrary configured local text models: custom model IDs remain in the existing thread selector and receive a local fallback descriptor for rendering, message dispatch, menu conditions, and model switching.
- The 2.2.105 build also hardens the existing thread model filter when a custom local model is present alongside persisted messages, preventing the final bundled-catalog tag lookup from dereferencing an absent record.
- The 2.2.106 build preserves arbitrary local thread model IDs through the recovered JournalEntryPage data-model migration instead of resetting them to the bundled Cibola default.
- The 2.2.107 build adds the configured local music model to the existing song-generation selector, preserving the original hosted catalog and UI.
- The 2.2.108 build allows configured local providers to expose the existing document-generation controls to eligible non-GM owners, while preserving the hosted account gate when local mode is disabled.
- The 2.2.109 v14 compatibility bridge extends the existing Actor control to Item, JournalEntry, RollTable, and Tile sheets when their legacy header hooks are absent, reusing the same image generator and document ownership checks.

## Intentionally not hosted by this fork

The personal fork does not require Cibola accounts, subscriptions, credits, telemetry, or a Cibola server for the validated local workflows. Public/community gallery browsing and the legacy hosted translation queue remain unavailable. Personal local packs, local generated-image gallery records, local vector-library management, and configurable local music generation are available; semantic vector retrieval and public community views remain out of scope for local mode.

## Next parity targets

The highest-value remaining work is end-to-end validation of image application into each supported Foundry document type and clearer capability/error presentation for user-supplied image models. Public community gallery actions and AI document translation remain intentionally out of the local-only slice.
