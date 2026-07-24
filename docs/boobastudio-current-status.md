# BoobaStudio current implementation status

This status reflects the locally built package prepared as version **2.2.78**. The public server remains on 2.2.75 until repository write access is restored.

## Verified

- Foundry v14 Build 363 loads the module from the normal module installer.
- The existing Cibola application structure, templates, settings, document hooks, image editor, history, gallery, and file handling remain in use.
- Client-scoped provider settings support OpenAI-compatible endpoints, OpenRouter, Ollama, LM Studio, Anthropic, Gemini, ComfyUI, Stability AI, Replicate, OpenAI TTS, and ElevenLabs.
- Existing prose generation can submit a prompt, render a result, insert it into a Journal editor, and persist the JournalEntryPage update.
- The existing direct `/c8` chat path bypasses the hosted account-connectivity check when a local provider is configured; its local response is normalized to the existing chat message object and browser-local history contract.
- Direct `/c8` chat no longer requires the legacy client-only-mode toggle or hosted confirmation gate when a local provider is explicitly configured; the legacy gates remain active for unconfigured sessions.
- Existing AI Thread JournalEntryPage sheets now recognize an explicitly configured local provider for account visibility, messaging controls, and local vector-file upload access; thread messages continue to persist in the existing JournalEntryPage `system.messages` field.
- Local vector files with extractable text can now provide ranked token-overlap context to local text requests through a client setting; this is a lightweight local retrieval fallback, not a hosted embedding index.
- Local provider chat fallback accepts the existing workflow modes used by threads, name generation, and other Cibola chat callers instead of restricting local use to the literal `chat` mode.
- The existing `enhance` façade now routes through the local text provider and preserves its `{result}` callback contract for prompt improvement and document enhancement workflows.
- Local-provider startup now skips the hosted model/config fetch and retains the bundled model defaults; hosted mode continues to use the original remote configuration path.
- Existing scene image generation can preview a result and expose Save, Save As, Apply as Tile, and Download actions.
- Local image generation bypasses the legacy hosted client-only session confirmation only when a local provider is configured; unconfigured sessions retain the original safety gate.
- Existing image-tools description action now routes image data URLs through the configured OpenAI-compatible vision model and returns the original `{status:"done",result}` callback shape; the UI and editor insertion path are unchanged.
- Existing image edit/variation requests that include an input image or mask now route to the configured OpenAI-compatible `/images/edits` endpoint as multipart form data, while ordinary generation continues to use `/images/generations`; data-URL inputs are converted in the browser without a server upload.
- Existing image prompt-builder action now routes `{command, amount}` through the local text provider, validates the returned JSON array, and preserves the original prompt-tab population flow.
- Existing narration/TTS generation now routes through the configured OpenAI or ElevenLabs adapter and preserves the existing audio preview, Foundry upload, and playlist flow.
- Local TTS voice-catalog requests return an empty local catalog instead of contacting Cibola; hosted voice search remains unchanged when local mode is disabled.
- Existing song generation now supports a client-configured Replicate music model, with configurable model-input JSON and placeholder substitution, while preserving the existing song preview, download, and playlist flow.
- Local song results are indexed in the same browser-local gallery store and returned through the existing `filter:"song"` browser contract.
- Actor sheet integration opens the existing image application with the selected Actor as its source document.
- Generated Actor images can be saved through Foundry file handling and update the Actor image field; no arbitrary server path is written by browser code.
- Provider requests and responses are normalized in the existing Cibola-compatible façade. Errors distinguish network/CORS, timeout, invalid key, access denied, rate limit, and generic provider failures.
- Locally configured image generations are persisted in browser-local storage through the existing gallery request/delete façade. The live Foundry browser probe confirmed pagination, record shape, and deletion without a Cibola-hosted request.
- The local gallery façade now returns the existing `pagy.next` shape used by the browser’s infinite-scroll and embedded gallery components.
- Local gallery share and public-toggle actions now return an explicit local-mode limitation instead of reaching Cibola-hosted endpoints.
- Existing gallery pack actions are explicitly disabled in local mode, preventing accidental requests to the hosted community-pack APIs.
- The existing vector-store upload, list, and delete callbacks now have a browser-local persistence path using the same Cibola-compatible response shape. Text-file content is retained locally when it fits the browser storage limit; no external vector index is required for library management.
- Existing scene wall detection remains fully local through the bundled OpenCV.js worker and Foundry wall-document update path; it does not require a provider or Cibola service.
- The visible active UI is rebranded to BoobaStudio; the legacy `cibola8` namespace and persisted data remain available for migration compatibility.
- Automated checks pass: package validation, provider smoke tests, JavaScript syntax/build, and live Foundry smoke validation.

## Intentionally not hosted by this fork

The personal fork does not require Cibola accounts, subscriptions, credits, telemetry, or a Cibola server for the validated local workflows. Hosted gallery/community packs and the legacy hosted translation queue remain unavailable unless a compatible replacement is configured or implemented. Local generated-image gallery records, local vector-library management, and configurable local music generation are available; semantic vector retrieval, the full existing gallery browser, and hosted community views still need deeper parity work.

## Next parity targets

The existing image editor already exposes advanced operations. The next useful validation work is provider-capability gating and live mocked checks for Replicate inpainting, outpainting, background removal, and upscale, followed by local persistence for threads/gallery metadata where the existing hosted contract cannot be reused.
